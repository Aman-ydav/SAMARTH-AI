import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { User } from "#modules/users/user.model.js";
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { ApiError } from "#utils/apiError.js";
import { googleSignIn, unlinkGoogle } from "./google.service.js";
import { RefreshSession } from "./refreshSession.model.js";
import { issueEmailToken, peekEmailToken } from "./tokens.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const profile = (overrides = {}) => ({
    sub: "g-100",
    email: "ana@example.test",
    name: "Ana Rao",
    ...overrides,
});
const contextFor = (profileData, envOverrides) => {
    const ctx = makeAuthCtx({ env: envOverrides });
    ctx.verifyGoogleCredential.mockResolvedValue(profileData);
    return ctx;
};
const signIn = (ctx, extra = {}) =>
    googleSignIn({ credential: "google-credential-value", ...extra }, ctx);

describe("googleSignIn: new account (AUTH-43)", () => {
    it("creates an active, verified, password-less learner and starts a session", async () => {
        const ctx = contextFor(profile());
        const result = await signIn(ctx);
        const user = await User.findOne({ email: "ana@example.test" })
            .select("+passwordHash")
            .lean();
        expect(user).toMatchObject({
            name: "Ana Rao",
            role: "learner",
            status: "active",
            emailVerified: true,
            googleSub: "g-100",
            authProviders: ["google"],
        });
        expect(user.passwordHash).toBeUndefined();
        expect(result.user).toMatchObject({
            hasPassword: false,
            authProviders: ["google"],
            role: "learner",
        });
        expect(result.session.refreshToken).toBeTruthy();
        expect(result.reactivate).toBe(false);
        expect(
            await AuditLog.countDocuments({ action: "USER_REGISTERED" })
        ).toBe(1);

        await ctx.emailService.whenSettled();
        expect(ctx.outbox.find({ templateKey: "welcome" })).toHaveLength(1);
        expect(ctx.outbox.find({ templateKey: "new-device" })).toHaveLength(0);
    });

    it("passes the credential and nonce to the verifier and trusts nothing else from the client", async () => {
        const ctx = contextFor(profile());
        await googleSignIn({ credential: "cred-1", nonce: "n-1" }, ctx);
        expect(ctx.verifyGoogleCredential).toHaveBeenCalledWith("cred-1", {
            nonce: "n-1",
        });
    });

    it("applies the domain policy to new accounts only", async () => {
        const ctx = contextFor(profile({ email: "ana@gmail.example" }), {
            ALLOWED_EMAIL_DOMAINS: "gov.in",
        });
        await expect(signIn(ctx)).rejects.toMatchObject({
            statusCode: 403,
            code: "DOMAIN_NOT_ALLOWED",
        });
        expect(await User.countDocuments({})).toBe(0);
        await createUser({
            email: "old@gmail.example",
            googleSub: "g-100",
            authProviders: ["google"],
            passwordHash: null,
        });
        await expect(signIn(ctx)).resolves.toBeTruthy();
    });

    it("is refused when Google login is switched off, without calling Google", async () => {
        const ctx = contextFor(profile(), { ALLOW_GOOGLE_LOGIN: "false" });
        await expect(signIn(ctx)).rejects.toMatchObject({
            statusCode: 403,
            code: "FORBIDDEN",
        });
        expect(ctx.verifyGoogleCredential).not.toHaveBeenCalled();
    });

    it.each([
        ["GOOGLE_TOKEN_INVALID", 401],
        ["GOOGLE_EMAIL_UNVERIFIED", 401],
    ])(
        "passes a verifier failure (%s) through and creates nothing",
        async (code, statusCode) => {
            const ctx = makeAuthCtx();
            ctx.verifyGoogleCredential.mockRejectedValue(
                ApiError.fromCode(code)
            );
            await expect(signIn(ctx)).rejects.toMatchObject({
                statusCode,
                code,
            });
            expect(await User.countDocuments({})).toBe(0);
        }
    );
});

describe("googleSignIn: existing accounts", () => {
    it("matches by sub first, even if the Google email changed", async () => {
        const user = await createUser({
            email: "old@example.test",
            googleSub: "g-100",
            authProviders: ["google"],
            passwordHash: null,
        });
        const ctx = contextFor(profile({ email: "renamed@example.test" }));
        const result = await signIn(ctx);
        expect(result.user.id).toBe(String(user._id));
        expect(await User.countDocuments({})).toBe(1);
        expect((await User.findById(user._id).lean()).email).toBe(
            "old@example.test"
        );
    });

    it("links a VERIFIED local account: keeps the password, adds Google, audits and mails", async () => {
        const owner = await createUser({ email: "ana@example.test" });
        const ctx = contextFor(profile());
        const result = await signIn(ctx);
        const saved = await User.findById(owner._id)
            .select("+passwordHash")
            .lean();
        expect(saved).toMatchObject({ googleSub: "g-100", status: "active" });
        expect([...saved.authProviders].sort()).toEqual(["google", "local"]);
        expect(saved.passwordHash).toBeTruthy();
        expect(result.user.id).toBe(String(owner._id));
        expect(await AuditLog.countDocuments({ action: "GOOGLE_LINKED" })).toBe(
            1
        );
        await ctx.emailService.whenSettled();
        expect(
            ctx.outbox.find({ to: owner.email, templateKey: "google-linked" })
        ).toHaveLength(1);
        expect(await User.countDocuments({})).toBe(1);
    });

    it("does NOT link an UNVERIFIED local account: wipes its password and verification, makes it a Google account", async () => {
        const squatter = await createUser({
            email: "ana@example.test",
            status: "pending_verification",
            emailVerified: false,
            name: "Squatter",
        });
        const { token } = await issueEmailToken({
            type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            userId: squatter._id,
            email: squatter.email,
        });
        const ctx = contextFor(profile());
        const result = await signIn(ctx);

        const saved = await User.findById(squatter._id)
            .select("+passwordHash +passwordHistory")
            .lean();
        expect(saved.passwordHash).toBeUndefined();
        expect(saved.passwordHistory).toEqual([]);
        expect(saved).toMatchObject({
            status: "active",
            emailVerified: true,
            googleSub: "g-100",
            name: "Ana Rao",
            authProviders: ["google"],
        });
        expect(
            await peekEmailToken({ token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY })
        ).toBeNull();
        expect(result.user.hasPassword).toBe(false);
        const [event] = await AuditLog.find({ action: "GOOGLE_LINKED" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({ mode: "replaced_unverified" });
    });

    it("sends the new-device mail for an existing user on an unseen device", async () => {
        await createUser({
            email: "ana@example.test",
            googleSub: "g-100",
            authProviders: ["google"],
            passwordHash: null,
        });
        const ctx = contextFor(profile());
        await signIn(ctx);
        await ctx.emailService.whenSettled();
        expect(ctx.outbox.find({ templateKey: "new-device" })).toHaveLength(1);
    });

    it("applies the same status gate as password login (AUTH-45)", async () => {
        const suspended = await createUser({
            email: "ana@example.test",
            googleSub: "g-100",
            authProviders: ["google"],
            passwordHash: null,
            status: "suspended",
        });
        const ctx = contextFor(profile());
        await expect(signIn(ctx)).rejects.toMatchObject({
            statusCode: 403,
            code: "ACCOUNT_SUSPENDED",
        });
        expect(await RefreshSession.countDocuments({})).toBe(0);

        await User.updateOne({ _id: suspended._id }, { status: "deactivated" });
        await expect(signIn(ctx)).rejects.toMatchObject({
            code: "ACCOUNT_DEACTIVATED",
        });
        const reactivated = await signIn(ctx, { reactivate: true });
        expect(reactivated.reactivate).toBe(true);
        expect((await User.findById(suspended._id).lean()).status).toBe(
            "active"
        );

        await User.updateOne(
            { _id: suspended._id },
            {
                status: "pending_deletion",
                deletionScheduledAt: new Date(Date.now() + 1000),
            }
        );
        const cancelled = await signIn(ctx);
        expect(cancelled.reactivate).toBe(true);
        expect(await User.findById(suspended._id).lean()).toMatchObject({
            status: "active",
            deletionScheduledAt: null,
        });
    });
});

describe("unlinkGoogle (AUTH-44, R38)", () => {
    it("removes Google from an account that also has a password", async () => {
        const user = await createUser({
            googleSub: "g-100",
            authProviders: ["local", "google"],
        });
        const ctx = contextFor(profile());
        const summary = await unlinkGoogle(
            { userId: user._id, credential: "google-credential-value" },
            ctx
        );
        expect(summary).toMatchObject({
            authProviders: ["local"],
            hasPassword: true,
        });
        const saved = await User.findById(user._id).lean();
        expect(saved.googleSub).toBeUndefined();
        expect(
            await AuditLog.countDocuments({ action: "GOOGLE_UNLINKED" })
        ).toBe(1);
        // the sub is free again
        await expect(
            createUser({
                googleSub: "g-100",
                authProviders: ["google"],
                passwordHash: null,
            })
        ).resolves.toBeTruthy();
    });

    it("refuses to remove the last sign-in method with AUTH_METHOD_REQUIRED", async () => {
        const user = await createUser({
            googleSub: "g-100",
            authProviders: ["google"],
            passwordHash: null,
        });
        await expect(
            unlinkGoogle(
                { userId: user._id, credential: "google-credential-value" },
                contextFor(profile())
            )
        ).rejects.toMatchObject({
            statusCode: 409,
            code: "AUTH_METHOD_REQUIRED",
        });
        expect((await User.findById(user._id).lean()).googleSub).toBe("g-100");
    });

    it("needs a fresh credential for the LINKED Google account", async () => {
        const user = await createUser({
            googleSub: "g-100",
            authProviders: ["local", "google"],
        });
        await expect(
            unlinkGoogle(
                { userId: user._id, credential: "google-credential-value" },
                contextFor(profile({ sub: "another" }))
            )
        ).rejects.toMatchObject({ statusCode: 403, code: "REAUTH_REQUIRED" });
    });

    it("answers 409 CONFLICT when Google is not linked and 404 for an unknown user", async () => {
        const user = await createUser();
        await expect(
            unlinkGoogle(
                { userId: user._id, credential: "google-credential-value" },
                contextFor(profile())
            )
        ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
        await expect(
            unlinkGoogle(
                {
                    userId: "64b7f0f0f0f0f0f0f0f0f0f1",
                    credential: "google-credential-value",
                },
                contextFor(profile())
            )
        ).rejects.toMatchObject({ statusCode: 404 });
    });
});
