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
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { fromOtherDevice, makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { LoginAttempt } from "./loginAttempt.model.js";
import { loginWithPassword } from "./login.service.js";
import { RefreshSession } from "./refreshSession.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const ctx = makeAuthCtx();
const login = (input, context = ctx, now) =>
    loginWithPassword({ password: TEST_PASSWORD, ...input }, context, now);
const reject = (promise, statusCode, code) =>
    expect(promise).rejects.toMatchObject({ statusCode, code });

describe("successful login (AUTH-37)", () => {
    it("returns the user, creates a session and a refresh token, and resets counters", async () => {
        const user = await createUser({ failedLoginCount: 3, lockoutCount: 1 });
        const result = await login({ email: user.email });
        expect(result.user).toMatchObject({
            id: String(user._id),
            status: "active",
            hasPassword: true,
        });
        expect(result.session.refreshToken).toBeTruthy();
        expect(result.reactivate).toBe(false);
        expect(await RefreshSession.countDocuments({ userId: user._id })).toBe(
            1
        );
        const saved = await User.findById(user._id).lean();
        expect(saved).toMatchObject({
            failedLoginCount: 0,
            lockoutCount: 0,
            lockUntil: null,
        });
        expect(saved.lastLoginAt).toBeInstanceOf(Date);
    });

    it("finds the account whatever the case or Unicode form of the email", async () => {
        const user = await createUser({ email: "mixed.case@example.test" });
        await expect(
            login({ email: "  Mixed.CASE@Example.TEST " })
        ).resolves.toBeTruthy();
        await expect(
            login({ email: "ｍixed.case@example.test" })
        ).resolves.toBeTruthy();
        expect(user).toBeTruthy();
    });

    it("rememberMe only changes the session flag", async () => {
        const user = await createUser();
        const result = await login({ email: user.email, rememberMe: true });
        expect(result.session.remember).toBe(true);
        expect(
            (await RefreshSession.findOne({ userId: user._id }).lean()).remember
        ).toBe(true);
    });

    it("audits LOGIN_SUCCESS", async () => {
        const user = await createUser();
        await login({ email: user.email });
        expect(await AuditLog.countDocuments({ action: "LOGIN_SUCCESS" })).toBe(
            1
        );
    });

    it("sends the new-device mail and audit for an unseen device, not for a known one (AUTH-39)", async () => {
        const user = await createUser();
        await login({ email: user.email });
        await login({ email: user.email });
        await login(
            { email: user.email },
            fromOtherDevice(
                ctx,
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/17 Safari/605"
            )
        );
        await ctx.emailService.whenSettled();
        const mails = ctx.outbox.find({
            to: user.email,
            templateKey: "new-device",
        });
        expect(mails.length).toBeGreaterThanOrEqual(1);
        expect(mails.at(-1).data.device).toBe("Safari on macOS");
        expect(
            await AuditLog.countDocuments({ action: "LOGIN_NEW_DEVICE" })
        ).toBeGreaterThanOrEqual(1);
    });
});

describe("credential failures are all INVALID_CREDENTIALS (AUTH-34)", () => {
    it("wrong password", async () => {
        const user = await createUser();
        await reject(
            login({ email: user.email, password: "Wrong-Password-Value-1" }),
            401,
            "INVALID_CREDENTIALS"
        );
    });

    it("unknown email, and a bcrypt compare still runs against the dummy hash (AUTH-23)", async () => {
        const compare = vi.spyOn(bcrypt, "compare");
        await reject(
            login({ email: "nobody@example.test" }),
            401,
            "INVALID_CREDENTIALS"
        );
        expect(compare).toHaveBeenCalledTimes(1);
        expect(compare.mock.calls[0][1]).toMatch(/^\$2b\$12\$/);
    });

    it("a Google-only account (no password hash) also costs one compare", async () => {
        const user = await createUser({
            passwordHash: null,
            authProviders: ["google"],
            googleSub: "g-1",
        });
        const compare = vi.spyOn(bcrypt, "compare");
        await reject(login({ email: user.email }), 401, "INVALID_CREDENTIALS");
        expect(compare).toHaveBeenCalledTimes(1);
    });

    it("a password over 72 bytes never matches, even when its first 72 bytes do", async () => {
        const user = await createUser();
        await reject(
            login({
                email: user.email,
                password: TEST_PASSWORD + "x".repeat(60),
            }),
            401,
            "INVALID_CREDENTIALS"
        );
    });

    it("gives the same error and the same shape for known and unknown accounts", async () => {
        const user = await createUser();
        const errors = [];
        for (const email of [user.email, "ghost@example.test"]) {
            errors.push(
                await login({
                    email,
                    password: "Wrong-Password-Value-1",
                }).catch((e) => e)
            );
        }
        expect(errors[0].code).toBe(errors[1].code);
        expect(errors[0].message).toBe(errors[1].message);
        expect(errors[0].errors).toEqual(errors[1].errors);
    });

    it("a deleted account looks like an unknown one", async () => {
        const user = await createUser({ status: "deleted" });
        await reject(login({ email: user.email }), 401, "INVALID_CREDENTIALS");
    });
});

describe("lockout (AUTH-36)", () => {
    async function failTimes(email, times) {
        for (let i = 0; i < times; i += 1) {
            await login({ email, password: "Wrong-Password-Value-1" }).catch(
                () => {}
            );
        }
    }

    it("locks after 5 failures: the 6th attempt is ACCOUNT_LOCKED with retryAfterSec, even with the right password", async () => {
        const user = await createUser();
        await failTimes(user.email, 4);
        await reject(
            login({ email: user.email, password: "Wrong-Password-Value-1" }),
            401,
            "INVALID_CREDENTIALS"
        );
        const error = await login({ email: user.email }).catch((e) => e);
        expect(error).toMatchObject({
            statusCode: 423,
            code: "ACCOUNT_LOCKED",
        });
        expect(error.retryAfterSec).toBeGreaterThan(890);
        expect(error.retryAfterSec).toBeLessThanOrEqual(900);
    });

    it("is identical for an existing and an unknown email", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const real = await createUser();
        const ghost = "ghost.account@example.test";
        const ctxs = [
            fromOtherDevice(makeAuthCtx({ ip: "198.51.100.1" }), "A"),
            fromOtherDevice(makeAuthCtx({ ip: "198.51.100.2" }), "A"),
        ];
        for (let i = 0; i < 5; i += 1) {
            await login(
                { email: real.email, password: "Wrong-Password-Value-1" },
                ctxs[0]
            ).catch(() => {});
            await login(
                { email: ghost, password: "Wrong-Password-Value-1" },
                ctxs[1]
            ).catch(() => {});
        }
        const [a, b] = await Promise.all([
            login({ email: real.email }, ctxs[0]).catch((e) => e),
            login({ email: ghost }, ctxs[1]).catch((e) => e),
        ]);
        expect(a).toMatchObject({
            statusCode: 423,
            code: "ACCOUNT_LOCKED",
            message: b.message,
        });
        expect(a.retryAfterSec).toBe(b.retryAfterSec);
        expect(a.errors).toEqual(b.errors);
    });

    it("doubles the lock with every further failure and unlocks when time passes", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const user = await createUser();
        await failTimes(user.email, 5);
        vi.setSystemTime(new Date("2026-10-26T10:15:01Z"));
        // lock over: one more wrong password locks for 30 minutes
        await reject(
            login({ email: user.email, password: "Wrong-Password-Value-1" }),
            401,
            "INVALID_CREDENTIALS"
        );
        const second = await login({ email: user.email }).catch((e) => e);
        expect(second.retryAfterSec).toBeGreaterThan(1790);
        vi.setSystemTime(new Date("2026-10-26T10:46:00Z"));
        await expect(login({ email: user.email })).resolves.toBeTruthy();
        expect(await LoginAttempt.countDocuments({ kind: "email" })).toBe(0);
    });

    it("mirrors the counters on the user, mails and audits the lock once, for real accounts only", async () => {
        const user = await createUser();
        await failTimes(user.email, 6);
        await failTimes("ghost@example.test", 6);
        await ctx.emailService.whenSettled();
        const saved = await User.findById(user._id).lean();
        expect(saved).toMatchObject({ failedLoginCount: 5, lockoutCount: 1 });
        expect(saved.lockUntil.getTime()).toBeGreaterThan(Date.now());
        const mails = ctx.outbox.find({ templateKey: "account-locked" });
        expect(mails.filter((mail) => mail.to === user.email)).toHaveLength(1);
        expect(
            mails.filter((mail) => mail.to === "ghost@example.test")
        ).toHaveLength(0);
        expect(
            await AuditLog.countDocuments({ action: "ACCOUNT_LOCKED" })
        ).toBe(1);
        expect(
            await AuditLog.countDocuments({ action: "LOGIN_FAILED" })
        ).toBeGreaterThanOrEqual(10);
    });

    it("never stores a raw email or IP in the audit log or the counters", async () => {
        const user = await createUser({ email: "visible.check@example.test" });
        await failTimes(user.email, 2);
        const dump = JSON.stringify([
            await AuditLog.find({}).limit(20).lean(),
            await LoginAttempt.find({}).limit(20).lean(),
        ]);
        expect(dump).not.toContain("visible.check");
        expect(dump).not.toContain("203.0.113");
    });

    it("a successful login clears the shadow counter", async () => {
        const user = await createUser();
        await failTimes(user.email, 3);
        await login({ email: user.email });
        expect(await LoginAttempt.countDocuments({ kind: "email" })).toBe(0);
        await failTimes(user.email, 4);
        await expect(login({ email: user.email })).resolves.toBeTruthy();
    });
});

describe("status after a correct password (AUTH-35)", () => {
    it("pending_verification: EMAIL_NOT_VERIFIED, but a wrong password still gets INVALID_CREDENTIALS", async () => {
        const user = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        await reject(
            login({ email: user.email, password: "Wrong-Password-Value-1" }),
            401,
            "INVALID_CREDENTIALS"
        );
        await reject(login({ email: user.email }), 403, "EMAIL_NOT_VERIFIED");
        expect(await RefreshSession.countDocuments({})).toBe(0);
    });

    it("suspended: ACCOUNT_SUSPENDED", async () => {
        const user = await createUser({ status: "suspended" });
        await reject(login({ email: user.email }), 403, "ACCOUNT_SUSPENDED");
    });

    it("deactivated: ACCOUNT_DEACTIVATED, then success with reactivate: true re-activates the account", async () => {
        const user = await createUser({
            status: "deactivated",
            deactivatedAt: new Date(),
        });
        await reject(login({ email: user.email }), 403, "ACCOUNT_DEACTIVATED");
        const result = await login({ email: user.email, reactivate: true });
        expect(result.reactivate).toBe(true);
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "active",
            deactivatedAt: null,
        });
        expect(
            await AuditLog.countDocuments({ action: "USER_REACTIVATED" })
        ).toBe(1);
    });

    it("pending_deletion: succeeds with reactivate: true and cancels the deletion (R18)", async () => {
        const user = await createUser({
            status: "pending_deletion",
            deletionScheduledAt: new Date(Date.now() + 86_400_000),
        });
        const result = await login({ email: user.email });
        expect(result.reactivate).toBe(true);
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "active",
            deletionScheduledAt: null,
        });
        expect(
            await AuditLog.countDocuments({ action: "DELETION_CANCELLED" })
        ).toBe(1);
    });

    it("a status answer still resets the failure counter (the password was right)", async () => {
        const user = await createUser({ status: "suspended" });
        await login({
            email: user.email,
            password: "Wrong-Password-Value-1",
        }).catch(() => {});
        await login({ email: user.email }).catch(() => {});
        expect(await LoginAttempt.countDocuments({ kind: "email" })).toBe(0);
    });

    it("mustChangePassword: success with a limited session and no refresh token (AUTH-38)", async () => {
        const user = await createUser({ mustChangePassword: true });
        const result = await login({ email: user.email });
        expect(result.session.refreshToken).toBeUndefined();
        expect(result.user.mustChangePassword).toBe(true);
        expect(await RefreshSession.countDocuments({})).toBe(0);
    });
});
