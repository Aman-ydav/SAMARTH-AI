import {
    afterAll,
    afterEach,
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
import { tokenOf } from "#integrations/email/memory.adapter.js";
import {
    confirmEmailChange,
    requestEmailChange,
    undoEmailChange,
} from "./emailChange.service.js";
import { RefreshSession } from "./refreshSession.model.js";
import { createSession } from "./session.service.js";
import { peekEmailToken } from "./tokens.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const NEW_EMAIL = "new.address@example.test";
const TYPE = AUTH_TOKEN_TYPES.EMAIL_CHANGE;

async function requested(overrides = {}) {
    const ctx = makeAuthCtx();
    const user = await createUser({
        email: "old.address@example.test",
        ...overrides,
    });
    await requestEmailChange(
        {
            userId: user._id,
            newEmail: NEW_EMAIL,
            currentPassword: TEST_PASSWORD,
        },
        ctx
    );
    await ctx.emailService.whenSettled();
    const confirmMail = ctx.outbox.latest({
        to: NEW_EMAIL,
        templateKey: "email-change-confirm",
    });
    const noticeMail = ctx.outbox.latest({
        to: user.email,
        templateKey: "email-change-notice",
    });
    return {
        ctx,
        user,
        confirmMail,
        noticeMail,
        confirmToken: tokenOf(confirmMail),
        undoToken: tokenOf(noticeMail),
    };
}

describe("requestEmailChange (doc 08 #16)", () => {
    it("mails the confirmation to the NEW address and an undo notice to the OLD one, and changes nothing yet", async () => {
        const { user, confirmMail, noticeMail, confirmToken, undoToken } =
            await requested();
        expect(confirmMail.data.link).toMatch(/\/confirm-email-change#token=/);
        expect(confirmMail.data.expiresIn).toBe("24 hours");
        expect(noticeMail.data).toMatchObject({
            newEmailMasked: "n***@example.test",
            expiresIn: "24 hours",
        });
        expect(noticeMail.data.undoLink).toMatch(/\/undo-email-change#token=/);
        expect(JSON.stringify(noticeMail.data)).not.toContain(NEW_EMAIL);
        expect(confirmToken).not.toBe(undoToken);
        expect((await User.findById(user._id).lean()).email).toBe(
            "old.address@example.test"
        );

        const confirm = await peekEmailToken({
            token: confirmToken,
            type: TYPE,
            kind: "confirm",
        });
        expect(confirm).toMatchObject({
            email: NEW_EMAIL,
            meta: { oldEmail: user.email, newEmail: NEW_EMAIL },
        });
        expect(
            await peekEmailToken({ token: undoToken, type: TYPE, kind: "undo" })
        ).toBeTruthy();
        expect(
            await AuditLog.countDocuments({ action: "EMAIL_CHANGE_REQUESTED" })
        ).toBe(1);
    });

    it("sends nothing and says nothing when the address is the current one or belongs to someone else", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        const other = await createUser();
        for (const newEmail of [
            user.email,
            other.email,
            user.email.toUpperCase(),
        ]) {
            await expect(
                requestEmailChange(
                    {
                        userId: user._id,
                        newEmail,
                        currentPassword: TEST_PASSWORD,
                    },
                    ctx
                )
            ).resolves.toBeUndefined();
        }
        await ctx.emailService.whenSettled();
        expect(ctx.outbox.all()).toHaveLength(0);
    });

    it("re-authenticates (wrong password, no proof)", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        await expect(
            requestEmailChange(
                {
                    userId: user._id,
                    newEmail: NEW_EMAIL,
                    currentPassword: "Wrong-Password-Value-1",
                },
                ctx
            )
        ).rejects.toMatchObject({
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
        await expect(
            requestEmailChange({ userId: user._id, newEmail: NEW_EMAIL }, ctx)
        ).rejects.toMatchObject({
            code: "REAUTH_REQUIRED",
        });
    });

    it("lets a Google-only account confirm with a fresh credential", async () => {
        const ctx = makeAuthCtx();
        ctx.verifyGoogleCredential.mockResolvedValue({
            sub: "g-1",
            email: "x@example.test",
            name: "X",
        });
        const user = await createUser({
            passwordHash: null,
            googleSub: "g-1",
            authProviders: ["google"],
        });
        await requestEmailChange(
            {
                userId: user._id,
                newEmail: NEW_EMAIL,
                credential: "google-credential-value",
            },
            ctx
        );
        await ctx.emailService.whenSettled();
        expect(
            ctx.outbox.find({
                to: NEW_EMAIL,
                templateKey: "email-change-confirm",
            })
        ).toHaveLength(1);
    });

    it("applies the domain policy to the new address with an explicit error", async () => {
        const ctx = makeAuthCtx({
            env: { ALLOWED_EMAIL_DOMAINS: "example.test" },
        });
        const user = await createUser();
        await expect(
            requestEmailChange(
                {
                    userId: user._id,
                    newEmail: "x@gmail.example",
                    currentPassword: TEST_PASSWORD,
                },
                ctx
            )
        ).rejects.toMatchObject({
            statusCode: 403,
            code: "DOMAIN_NOT_ALLOWED",
            errors: [expect.objectContaining({ field: "newEmail" })],
        });
    });

    it("a second request replaces the first confirmation link", async () => {
        const first = await requested();
        await requestEmailChange(
            {
                userId: first.user._id,
                newEmail: "third.address@example.test",
                currentPassword: TEST_PASSWORD,
            },
            first.ctx
        );
        expect(
            await peekEmailToken({
                token: first.confirmToken,
                type: TYPE,
                kind: "confirm",
            })
        ).toBeNull();
        expect(
            await peekEmailToken({
                token: first.undoToken,
                type: TYPE,
                kind: "undo",
            })
        ).toBeNull();
    });
});

describe("confirmEmailChange (doc 08 #17)", () => {
    it("applies the new address, verifies it, audits with hashes only, and mails a fresh 24 h undo link to the old address", async () => {
        const { ctx, user, confirmToken, undoToken } = await requested();
        ctx.outbox.clear();
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).resolves.toEqual({ emailChanged: true });
        expect(await User.findById(user._id).lean()).toMatchObject({
            email: NEW_EMAIL,
            emailVerified: true,
        });

        await ctx.emailService.whenSettled();
        const notice = ctx.outbox.latest({
            to: "old.address@example.test",
            templateKey: "email-change-notice",
        });
        const freshUndo = tokenOf(notice);
        expect(freshUndo).toBeTruthy();
        expect(freshUndo).not.toBe(undoToken);
        expect(
            await peekEmailToken({ token: undoToken, type: TYPE, kind: "undo" })
        ).toBeNull();

        const [event] = await AuditLog.find({ action: "EMAIL_CHANGED" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({
            oldEmailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            newEmailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        expect(JSON.stringify(event)).not.toContain("address@example.test");
    });

    it("works once, and rejects unknown, malformed and wrong-kind tokens with EMAIL_CHANGE_INVALID", async () => {
        const { ctx, confirmToken, undoToken } = await requested();
        await confirmEmailChange({ token: confirmToken }, ctx);
        for (const token of [
            confirmToken,
            "u".repeat(43),
            "garbage",
            undoToken,
        ]) {
            await expect(
                confirmEmailChange({ token }, ctx)
            ).rejects.toMatchObject({
                statusCode: 400,
                code: "EMAIL_CHANGE_INVALID",
            });
        }
    });

    it("expires after 24 hours (fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { ctx, confirmToken } = await requested();
        vi.setSystemTime(new Date("2026-10-27T10:00:01Z"));
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
    });

    it("is invalid when the account's address changed in the meantime", async () => {
        const { ctx, user, confirmToken } = await requested();
        await User.updateOne(
            { _id: user._id },
            { email: "moved.elsewhere@example.test" }
        );
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
    });

    it("is invalid when someone registered the new address first (unique index)", async () => {
        const { ctx, user, confirmToken } = await requested();
        await createUser({ email: NEW_EMAIL });
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
        expect((await User.findById(user._id).lean()).email).toBe(
            "old.address@example.test"
        );
    });

    it("is invalid for a suspended account", async () => {
        const { ctx, user, confirmToken } = await requested();
        await User.updateOne({ _id: user._id }, { status: "suspended" });
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
    });
});

describe("undoEmailChange (doc 08 #18, R38)", () => {
    it("restores the old address after it was applied, bumps tv and revokes ALL sessions", async () => {
        const { ctx, user, confirmToken } = await requested();
        await confirmEmailChange({ token: confirmToken }, ctx);
        await ctx.emailService.whenSettled();
        const undoToken = tokenOf(
            ctx.outbox.latest({
                to: "old.address@example.test",
                templateKey: "email-change-notice",
            })
        );
        await createSession({ user, ctx });
        await createSession({ user, ctx });

        await expect(
            undoEmailChange({ token: undoToken }, ctx)
        ).resolves.toEqual({ restored: true });
        expect(await User.findById(user._id).lean()).toMatchObject({
            email: "old.address@example.test",
            tokenVersion: 1,
        });
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        expect(
            await AuditLog.countDocuments({ action: "EMAIL_CHANGE_UNDONE" })
        ).toBe(1);
    });

    it("cancels a pending change before confirmation: the confirm link dies and sessions end", async () => {
        const { ctx, user, confirmToken, undoToken } = await requested();
        await createSession({ user, ctx });
        await undoEmailChange({ token: undoToken }, ctx);
        await expect(
            confirmEmailChange({ token: confirmToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
        expect((await User.findById(user._id).lean()).email).toBe(
            "old.address@example.test"
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
    });

    it("works once and rejects other tokens", async () => {
        const { ctx, confirmToken, undoToken } = await requested();
        await undoEmailChange({ token: undoToken }, ctx);
        for (const token of [undoToken, confirmToken, "garbage"]) {
            await expect(undoEmailChange({ token }, ctx)).rejects.toMatchObject(
                { statusCode: 400, code: "EMAIL_CHANGE_INVALID" }
            );
        }
    });

    it("is invalid when the account address is neither the old nor the new one", async () => {
        const { ctx, user, undoToken } = await requested();
        await User.updateOne(
            { _id: user._id },
            { email: "third.party@example.test" }
        );
        await expect(
            undoEmailChange({ token: undoToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
    });

    it("is invalid when the old address was taken by someone else after the change", async () => {
        const { ctx, confirmToken } = await requested();
        await confirmEmailChange({ token: confirmToken }, ctx);
        await ctx.emailService.whenSettled();
        const undoToken = tokenOf(
            ctx.outbox.latest({
                to: "old.address@example.test",
                templateKey: "email-change-notice",
            })
        );
        await createUser({ email: "old.address@example.test" });
        await expect(
            undoEmailChange({ token: undoToken }, ctx)
        ).rejects.toMatchObject({ code: "EMAIL_CHANGE_INVALID" });
    });
});
