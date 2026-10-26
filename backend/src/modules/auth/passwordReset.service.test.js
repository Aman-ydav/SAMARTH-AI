import bcrypt from "bcryptjs";
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
import {
    OTHER_PASSWORD,
    TEST_PASSWORD,
    createUser,
} from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { AuthToken } from "./authToken.model.js";
import { emailAttemptKey, recordFailure } from "./loginAttempt.service.js";
import { LoginAttempt } from "./loginAttempt.model.js";
import {
    forgotPassword,
    resetPassword,
    validateResetToken,
} from "./passwordReset.service.js";
import { RefreshSession } from "./refreshSession.model.js";
import { createSession } from "./session.service.js";
import { issueEmailToken, peekEmailToken } from "./tokens.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const TYPE = AUTH_TOKEN_TYPES.PASSWORD_RESET;
const NEW_PASSWORD = "Fresh-Unrelated-Passphrase-9";

async function requestReset(ctx, email) {
    forgotPassword({ email }, ctx);
    await whenBackgroundIdle();
    await ctx.emailService.whenSettled();
}
const resetMails = (ctx, email) =>
    ctx.outbox.find({ to: email, templateKey: "password-reset" });
const issueFor = (user, overrides = {}) =>
    issueEmailToken({
        type: TYPE,
        userId: user._id,
        orgId: user.orgId,
        email: user.email,
        ...overrides,
    });

describe("forgotPassword (AUTH-46..49)", () => {
    it("returns at once; later the active user gets a plain 30 minute link in the fragment", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        expect(forgotPassword({ email: user.email }, ctx)).toBeUndefined();
        expect(ctx.outbox.all()).toHaveLength(0);
        await whenBackgroundIdle();
        await ctx.emailService.whenSettled();

        const [mail] = resetMails(ctx, user.email);
        expect(mail.data).toMatchObject({
            name: user.name,
            expiresIn: "30 minutes",
            variant: "active",
        });
        expect(mail.data.link).toMatch(
            /^http:\/\/localhost:5173\/reset-password#token=[A-Za-z0-9_-]{43}$/
        );
        expect(mail.html).not.toMatch(/<img/i);
        expect(mail.text).toBeTruthy();
        expect(
            await AuditLog.countDocuments({
                action: "PASSWORD_RESET_REQUESTED",
            })
        ).toBe(1);
    });

    it("normalises the address", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({ email: "mixed@example.test" });
        await requestReset(ctx, "  MIXED@Example.TEST ");
        expect(resetMails(ctx, user.email)).toHaveLength(1);
    });

    it.each([
        ["unknown", async () => "nobody@example.test"],
        [
            "suspended",
            async () => (await createUser({ status: "suspended" })).email,
        ],
        [
            "pending_deletion",
            async () =>
                (await createUser({ status: "pending_deletion" })).email,
        ],
        [
            "invited",
            async () =>
                (await createUser({ status: "invited", passwordHash: null }))
                    .email,
        ],
        [
            "deleted",
            async () => (await createUser({ status: "deleted" })).email,
        ],
    ])(
        "sends nothing and creates no token for a %s address",
        async (_label, makeEmail) => {
            const ctx = makeAuthCtx();
            await requestReset(ctx, await makeEmail());
            expect(ctx.outbox.all()).toHaveLength(0);
            expect(await AuthToken.countDocuments({})).toBe(0);
        }
    );

    it("uses the google_only variant for an account without a password", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: null,
            authProviders: ["google"],
            googleSub: "g-1",
        });
        await requestReset(ctx, user.email);
        expect(resetMails(ctx, user.email)[0].data.variant).toBe("google_only");
        expect(resetMails(ctx, user.email)[0].text).toMatch(/set a password/i);
    });

    it("uses the unverified variant for a pending account", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        await requestReset(ctx, user.email);
        expect(resetMails(ctx, user.email)[0].data.variant).toBe("unverified");
        expect(resetMails(ctx, user.email)[0].text).toMatch(
            /confirms your email/i
        );
    });

    it("sends a link to a deactivated account (they can reset, then reactivate by logging in)", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({ status: "deactivated" });
        await requestReset(ctx, user.email);
        expect(resetMails(ctx, user.email)).toHaveLength(1);
    });

    it("the newest link wins: older links stop working", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        await requestReset(ctx, user.email);
        const first = latestToken(
            ctx.emailService,
            user.email,
            "password-reset"
        );
        await requestReset(ctx, user.email);
        const second = latestToken(
            ctx.emailService,
            user.email,
            "password-reset"
        );
        expect(second).not.toBe(first);
        expect(await peekEmailToken({ token: first, type: TYPE })).toBeNull();
        expect(
            await peekEmailToken({ token: second, type: TYPE })
        ).toBeTruthy();
    });

    it("answers the 4th request within an hour silently, and allows a new one an hour later (fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const ctx = makeAuthCtx();
        const user = await createUser();
        for (let i = 0; i < 4; i += 1) {
            await requestReset(ctx, user.email);
            vi.setSystemTime(Date.now() + 60_000);
        }
        expect(resetMails(ctx, user.email)).toHaveLength(3);
        vi.setSystemTime(new Date("2026-10-26T11:30:00Z"));
        await requestReset(ctx, user.email);
        expect(resetMails(ctx, user.email)).toHaveLength(4);
    });
});

describe("validateResetToken (R34)", () => {
    it("confirms a valid token without consuming it", async () => {
        const user = await createUser();
        const { token } = await issueFor(user);
        await expect(validateResetToken({ token })).resolves.toEqual({
            valid: true,
        });
        await expect(validateResetToken({ token })).resolves.toEqual({
            valid: true,
        });
        expect(
            (await AuthToken.findOne({ userId: user._id }).lean()).usedAt
        ).toBeNull();
    });

    it.each([
        ["unknown", async () => "z".repeat(43)],
        ["malformed", async () => "%%%"],
        [
            "of another type",
            async () =>
                (
                    await issueFor(await createUser(), {
                        type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
                    })
                ).token,
        ],
        [
            "issued for an address that changed",
            async () => {
                const user = await createUser();
                const { token } = await issueFor(user);
                await User.updateOne(
                    { _id: user._id },
                    { email: "moved@example.test" }
                );
                return token;
            },
        ],
        [
            "for a user who has since been suspended",
            async () => {
                const user = await createUser();
                const { token } = await issueFor(user);
                await User.updateOne(
                    { _id: user._id },
                    { status: "suspended" }
                );
                return token;
            },
        ],
    ])(
        "answers RESET_TOKEN_INVALID for a token that is %s",
        async (_label, make) => {
            await expect(
                validateResetToken({ token: await make() })
            ).rejects.toMatchObject({
                statusCode: 400,
                code: "RESET_TOKEN_INVALID",
            });
        }
    );

    it("rejects an expired token after 30 minutes (fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { token } = await issueFor(await createUser());
        vi.setSystemTime(new Date("2026-10-26T10:29:00Z"));
        await expect(validateResetToken({ token })).resolves.toEqual({
            valid: true,
        });
        vi.setSystemTime(new Date("2026-10-26T10:30:01Z"));
        await expect(validateResetToken({ token })).rejects.toMatchObject({
            code: "RESET_TOKEN_INVALID",
        });
    });
});

describe("resetPassword (AUTH-51..54)", () => {
    it("sets the new password and history, bumps tokenVersion, revokes ALL sessions, clears locks, mails, audits", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            failedLoginCount: 4,
            lockoutCount: 1,
            lockUntil: new Date(Date.now() + 600_000),
            mustChangePassword: true,
        });
        const before = await User.findById(user._id)
            .select("+passwordHash")
            .lean();
        for (let i = 0; i < 3; i += 1) await createSession({ user, ctx });
        const emailKey = emailAttemptKey(user.email, ctx.config);
        await recordFailure({ emailKey, ipKey: ctx.ipHash });
        const { token } = await issueFor(user);

        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);

        const after = await User.findById(user._id)
            .select("+passwordHash +passwordHistory")
            .lean();
        expect(await bcrypt.compare(NEW_PASSWORD, after.passwordHash)).toBe(
            true
        );
        expect(after.passwordHistory).toEqual([before.passwordHash]);
        expect(after).toMatchObject({
            tokenVersion: 1,
            failedLoginCount: 0,
            lockoutCount: 0,
            lockUntil: null,
            mustChangePassword: false,
        });
        expect(after.passwordChangedAt).toBeInstanceOf(Date);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        expect(
            (await RefreshSession.findOne({ userId: user._id }).lean())
                .revokedReason
        ).toBe("password_change");
        expect(await LoginAttempt.countDocuments({ keyHash: emailKey })).toBe(
            0
        );
        // no auto-login: the reset created no session
        expect(await RefreshSession.countDocuments({ userId: user._id })).toBe(
            3
        );

        await ctx.emailService.whenSettled();
        const [mail] = ctx.outbox.find({
            to: user.email,
            templateKey: "password-changed",
        });
        expect(mail.data.resetLink).toBe(
            "http://localhost:5173/forgot-password"
        );
        expect(
            await AuditLog.countDocuments({
                action: "PASSWORD_RESET_COMPLETED",
            })
        ).toBe(1);
    });

    it("consumes the token: it works once", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        const { token } = await issueFor(user);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);
        await expect(
            resetPassword(
                { token, newPassword: "Yet-Another-Long-Passphrase-3" },
                ctx
            )
        ).rejects.toMatchObject({
            code: "RESET_TOKEN_INVALID",
        });
    });

    it("two concurrent resets with one token: exactly one wins", async () => {
        const ctx = makeAuthCtx();
        const { token } = await issueFor(await createUser());
        const results = await Promise.allSettled([
            resetPassword({ token, newPassword: NEW_PASSWORD }, ctx),
            resetPassword(
                { token, newPassword: "Yet-Another-Long-Passphrase-3" },
                ctx
            ),
        ]);
        expect(
            results.filter((result) => result.status === "fulfilled")
        ).toHaveLength(1);
        const loser = results.find((result) => result.status === "rejected");
        expect(loser.reason).toMatchObject({ code: "RESET_TOKEN_INVALID" });
    });

    it.each([
        ["unknown", async () => "q".repeat(43)],
        ["malformed", async () => "<script>"],
        [
            "of another type",
            async () =>
                (
                    await issueFor(await createUser(), {
                        type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
                    })
                ).token,
        ],
    ])(
        "answers RESET_TOKEN_INVALID for a %s token before looking at the password",
        async (_label, make) => {
            await expect(
                resetPassword(
                    { token: await make(), newPassword: "weak" },
                    makeAuthCtx()
                )
            ).rejects.toMatchObject({
                code: "RESET_TOKEN_INVALID",
            });
        }
    );

    it("rejects an expired token (30 minutes)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { token } = await issueFor(await createUser());
        vi.setSystemTime(new Date("2026-10-26T10:31:00Z"));
        await expect(
            resetPassword({ token, newPassword: NEW_PASSWORD }, makeAuthCtx())
        ).rejects.toMatchObject({
            code: "RESET_TOKEN_INVALID",
        });
    });

    it("enforces the password policy BEFORE consuming the token, so the user can retry", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        const { token } = await issueFor(user);
        await expect(
            resetPassword({ token, newPassword: "short" }, ctx)
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "PASSWORD_POLICY",
            errors: [expect.objectContaining({ field: "newPassword" })],
        });
        expect(await peekEmailToken({ token, type: TYPE })).toBeTruthy();
        await expect(
            resetPassword({ token, newPassword: NEW_PASSWORD }, ctx)
        ).resolves.toBeUndefined();
    });

    it("refuses the current password and the last three, without consuming the token", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: await bcrypt.hash(OTHER_PASSWORD, 12),
        });
        const old = await bcrypt.hash("Oldest-History-Passphrase-1", 12);
        await User.updateOne({ _id: user._id }, { passwordHistory: [old] });
        const { token } = await issueFor(user);
        await expect(
            resetPassword({ token, newPassword: OTHER_PASSWORD }, ctx)
        ).rejects.toMatchObject({ code: "PASSWORD_REUSED" });
        await expect(
            resetPassword(
                { token, newPassword: "Oldest-History-Passphrase-1" },
                ctx
            )
        ).rejects.toMatchObject({ code: "PASSWORD_REUSED" });
        expect(await peekEmailToken({ token, type: TYPE })).toBeTruthy();
        await expect(
            resetPassword({ token, newPassword: NEW_PASSWORD }, ctx)
        ).resolves.toBeUndefined();
        const history = (
            await User.findById(user._id).select("+passwordHistory").lean()
        ).passwordHistory;
        expect(history).toHaveLength(2);
    });

    it("works while the account is locked and clears the lock", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            lockUntil: new Date(Date.now() + 900_000),
            failedLoginCount: 5,
        });
        const { token } = await issueFor(user);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);
        expect(await User.findById(user._id).lean()).toMatchObject({
            lockUntil: null,
            failedLoginCount: 0,
        });
    });

    it("verifies a pending account's email and activates it", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        const { token } = await issueFor(user);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "active",
            emailVerified: true,
        });
    });

    it("lets a Google-only account set its first password", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser({
            passwordHash: null,
            authProviders: ["google"],
            googleSub: "g-1",
        });
        const { token } = await issueFor(user);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);
        const saved = await User.findById(user._id)
            .select("+passwordHash +passwordHistory")
            .lean();
        expect(saved.passwordHash).toBeTruthy();
        expect(saved.passwordHistory).toEqual([]);
        expect([...saved.authProviders].sort()).toEqual(["google", "local"]);
    });

    it("rejects a token issued for an address the account no longer has", async () => {
        const user = await createUser();
        const { token } = await issueFor(user);
        await User.updateOne(
            { _id: user._id },
            { email: "renamed@example.test" }
        );
        await expect(
            resetPassword({ token, newPassword: NEW_PASSWORD }, makeAuthCtx())
        ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
    });

    it("rejects a password containing the user's name or email name", async () => {
        const user = await createUser({
            email: "zainab.khan@example.test",
            name: "Zainab Khan",
        });
        const { token } = await issueFor(user);
        await expect(
            resetPassword(
                { token, newPassword: "zainab.khan-rocks-2026" },
                makeAuthCtx()
            )
        ).rejects.toMatchObject({ code: "PASSWORD_POLICY" });
        await expect(
            resetPassword(
                { token, newPassword: "Khan is my family 2026" },
                makeAuthCtx()
            )
        ).rejects.toMatchObject({ code: "PASSWORD_POLICY" });
    });
});

describe("password never leaves the service", () => {
    it("reset leaves neither the password nor a hash in any mail or audit row", async () => {
        const ctx = makeAuthCtx();
        const user = await createUser();
        const { token } = await issueFor(user);
        await resetPassword({ token, newPassword: NEW_PASSWORD }, ctx);
        await ctx.emailService.whenSettled();
        const dump = JSON.stringify([
            ctx.outbox.all(),
            await AuditLog.find({}).limit(20).lean(),
        ]);
        expect(dump).not.toContain(NEW_PASSWORD);
        expect(dump).not.toContain(TEST_PASSWORD);
        expect(dump).not.toMatch(/\$2[ab]\$/);
    });
});
