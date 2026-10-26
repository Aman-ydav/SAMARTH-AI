import bcrypt from "bcryptjs";
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
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { AuthToken } from "./authToken.model.js";
import { describeTtl, registerUser } from "./register.service.js";
import { peekEmailToken } from "./tokens.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const input = (overrides = {}) => ({
    name: "Ana Learner",
    email: "ana.new@example.test",
    password: TEST_PASSWORD,
    acceptTerms: true,
    ...overrides,
});
const mailsTo = async (ctx, email, templateKey) => {
    await ctx.emailService.whenSettled();
    return ctx.outbox.find({
        to: email,
        ...(templateKey ? { templateKey } : {}),
    });
};

describe("registerUser: a new address (AUTH-26..28)", () => {
    it("creates a pending learner with a hashed password, consent and a verification mail", async () => {
        const ctx = makeAuthCtx();
        const result = await registerUser(
            input({ email: "  ANA.New@Example.TEST " }),
            ctx
        );
        expect(result).toBeUndefined();
        const user = await User.findOne({
            email: "ana.new@example.test",
        }).select("+passwordHash");
        expect(user).toMatchObject({
            name: "Ana Learner",
            role: "learner",
            status: "pending_verification",
            emailVerified: false,
            authProviders: ["local"],
            policyVersion: "2026-10-26",
        });
        expect(user.termsAcceptedAt).toBeInstanceOf(Date);
        expect(user.passwordHash).not.toContain(TEST_PASSWORD);
        expect(String(user.orgId)).toBe("000000000000000000000001");

        const mails = await mailsTo(ctx, user.email, "verify-email");
        expect(mails).toHaveLength(1);
        expect(mails[0].data.link).toMatch(
            /^http:\/\/localhost:5173\/verify-email#token=[A-Za-z0-9_-]{43}$/
        );
        expect(mails[0].data.expiresIn).toBe("24 hours");
    });

    it("binds the 24 hour token to the user and the address, and audits USER_REGISTERED without the email", async () => {
        const ctx = makeAuthCtx();
        await registerUser(input(), ctx);
        const user = await User.findOne({});
        await ctx.emailService.whenSettled();
        const token = latestToken(ctx.emailService, user.email, "verify-email");
        const record = await peekEmailToken({
            token,
            type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
        });
        expect(String(record.userId)).toBe(String(user._id));
        expect(record.email).toBe(user.email);
        expect(
            Math.abs(
                record.expiresAt.getTime() -
                    record.createdAt.getTime() -
                    24 * 3_600_000
            )
        ).toBeLessThan(2000);
        const [event] = await AuditLog.find({ action: "USER_REGISTERED" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({ provider: "local" });
        expect(JSON.stringify(event)).not.toContain(user.email);
    });

    it("always creates the role learner, whatever else is passed", async () => {
        await registerUser(
            { ...input(), role: "superadmin", status: "active", orgId: "x" },
            makeAuthCtx()
        );
        expect(await User.findOne({}).lean()).toMatchObject({
            role: "learner",
            status: "pending_verification",
        });
    });
});

describe("registerUser: existing addresses give no signal (AUTH-27)", () => {
    it("an active owner gets the already-registered mail and nothing else changes", async () => {
        const ctx = makeAuthCtx();
        const owner = await createUser({
            email: "owner@example.test",
            name: "Real Owner",
        });
        const result = await registerUser(
            input({ email: owner.email, name: "Impostor" }),
            ctx
        );
        expect(result).toBeUndefined();
        expect(await User.countDocuments({})).toBe(1);
        expect((await User.findById(owner._id).lean()).name).toBe("Real Owner");
        expect(await AuthToken.countDocuments({})).toBe(0);
        expect(await mailsTo(ctx, owner.email, "verify-email")).toHaveLength(0);
        const [mail] = await mailsTo(ctx, owner.email, "already-registered");
        expect(mail.data).toMatchObject({
            name: "Real Owner",
            loginLink: "http://localhost:5173/login",
            resetLink: "http://localhost:5173/forgot-password",
        });
    });

    it.each(["suspended", "deactivated", "pending_deletion"])(
        "a %s account owner also gets the already-registered mail",
        async (status) => {
            const ctx = makeAuthCtx();
            const owner = await createUser({ status });
            await registerUser(input({ email: owner.email }), ctx);
            expect(
                await mailsTo(ctx, owner.email, "already-registered")
            ).toHaveLength(1);
            expect(await User.countDocuments({})).toBe(1);
        }
    );

    it("a pending address gets a fresh verification: the new submission replaces the old, the old token dies", async () => {
        const ctx = makeAuthCtx();
        await registerUser(input({ name: "First Try" }), ctx);
        await ctx.emailService.whenSettled();
        const oldToken = latestToken(
            ctx.emailService,
            "ana.new@example.test",
            "verify-email"
        );
        ctx.outbox.clear();

        await registerUser(
            input({
                name: "Second Try",
                password: "Another-Long-Passphrase-Value-77",
            }),
            ctx
        );
        const user = await User.findOne({}).select("+passwordHash");
        expect(user.name).toBe("Second Try");
        expect(await User.countDocuments({})).toBe(1);
        expect(
            await bcrypt.compare(
                "Another-Long-Passphrase-Value-77",
                user.passwordHash
            )
        ).toBe(true);
        expect(
            await peekEmailToken({
                token: oldToken,
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            })
        ).toBeNull();
        const newToken =
            (await mailsTo(ctx, user.email, "verify-email")).length &&
            latestToken(ctx.emailService, user.email, "verify-email");
        expect(newToken).not.toBe(oldToken);
        expect(
            await peekEmailToken({
                token: newToken,
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
            })
        ).toBeTruthy();
    });

    it("hashes the password exactly once in every branch so the time does not reveal the branch", async () => {
        const hash = vi.spyOn(bcrypt, "hash");
        const ctx = makeAuthCtx();
        const owner = await createUser();
        hash.mockClear();
        await registerUser(input({ email: "brand.new@example.test" }), ctx);
        expect(hash).toHaveBeenCalledTimes(1);
        hash.mockClear();
        await registerUser(input({ email: owner.email }), ctx);
        expect(hash).toHaveBeenCalledTimes(1);
        hash.mockClear();
        await registerUser(input({ email: "brand.new@example.test" }), ctx);
        expect(hash).toHaveBeenCalledTimes(1);
    });

    it("two simultaneous registrations of one new address leave one user and no error (duplicate-key race)", async () => {
        const ctx = makeAuthCtx();
        const results = await Promise.allSettled([
            registerUser(input(), ctx),
            registerUser(input(), ctx),
            registerUser(input(), ctx),
        ]);
        expect(results.map((result) => result.status)).toEqual([
            "fulfilled",
            "fulfilled",
            "fulfilled",
        ]);
        expect(await User.countDocuments({})).toBe(1);
        const mails = await mailsTo(ctx, "ana.new@example.test");
        expect(mails.length).toBeGreaterThanOrEqual(1);
    });
});

describe("registerUser: policy errors", () => {
    it("rejects a disallowed domain explicitly, but accepts allowed domains and their subdomains", async () => {
        const ctx = makeAuthCtx({
            env: { ALLOWED_EMAIL_DOMAINS: "gov.in,nic.in" },
        });
        await expect(
            registerUser(input({ email: "x@gmail.example" }), ctx)
        ).rejects.toMatchObject({
            statusCode: 403,
            code: "DOMAIN_NOT_ALLOWED",
            errors: [expect.objectContaining({ field: "email" })],
        });
        await expect(
            registerUser(input({ email: "x@mospi.gov.in" }), ctx)
        ).resolves.toBeUndefined();
        await expect(
            registerUser(input({ email: "y@nic.in" }), ctx)
        ).resolves.toBeUndefined();
        await expect(
            registerUser(input({ email: "z@notgov.in" }), ctx)
        ).rejects.toMatchObject({ code: "DOMAIN_NOT_ALLOWED" });
    });

    it("refuses when self-registration is switched off", async () => {
        const ctx = makeAuthCtx({ env: { ALLOW_SELF_REGISTRATION: "false" } });
        await expect(registerUser(input(), ctx)).rejects.toMatchObject({
            statusCode: 403,
            code: "FORBIDDEN",
        });
        expect(await User.countDocuments({})).toBe(0);
    });

    it.each([
        ["too short", "short"],
        ["over 72 bytes", "x".repeat(73)],
        ["on the denylist", "Password123"],
        ["containing the email name", "my-ana.new-secret-1"],
        ["containing the name", "Learner forever 2026"],
    ])(
        "rejects a password %s with PASSWORD_POLICY and creates nothing",
        async (_label, password) => {
            const ctx = makeAuthCtx();
            await expect(
                registerUser(input({ password }), ctx)
            ).rejects.toMatchObject({
                statusCode: 400,
                code: "PASSWORD_POLICY",
            });
            expect(await User.countDocuments({})).toBe(0);
        }
    );

    it("checks the policy before looking at existing accounts", async () => {
        const owner = await createUser();
        await expect(
            registerUser(
                input({ email: owner.email, password: "weak" }),
                makeAuthCtx()
            )
        ).rejects.toMatchObject({
            code: "PASSWORD_POLICY",
        });
    });
});

describe("describeTtl", () => {
    it("words the lifetimes the way the mails show them", () => {
        expect(describeTtl("emailVerify")).toBe("24 hours");
        expect(describeTtl("passwordReset")).toBe("30 minutes");
        expect(describeTtl("invite")).toBe("7 days");
        expect(describeTtl("emailChange")).toBe("24 hours");
    });
});
