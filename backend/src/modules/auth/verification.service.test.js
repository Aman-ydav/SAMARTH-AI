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
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { AuthToken } from "./authToken.model.js";
import { RefreshSession } from "./refreshSession.model.js";
import { issueEmailToken } from "./tokens.service.js";
import { resendVerification, verifyEmail } from "./verification.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const TYPE = AUTH_TOKEN_TYPES.EMAIL_VERIFY;

async function pendingUser(overrides = {}) {
    const user = await createUser({
        status: "pending_verification",
        emailVerified: false,
        ...overrides,
    });
    const { token } = await issueEmailToken({
        type: TYPE,
        userId: user._id,
        orgId: user.orgId,
        email: user.email,
    });
    return { user, token };
}

describe("verifyEmail", () => {
    it("activates the account, consumes the token, starts a session and sends the welcome mail", async () => {
        const ctx = makeAuthCtx();
        const { user, token } = await pendingUser();
        const result = await verifyEmail({ token }, ctx);

        expect(result.user).toMatchObject({
            id: String(user._id),
            status: "active",
            emailVerified: true,
        });
        expect(result.session.refreshToken).toBeTruthy();
        expect(result.needsOnboarding).toBe(false);
        const saved = await User.findById(user._id).lean();
        expect(saved).toMatchObject({ status: "active", emailVerified: true });
        expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
        expect(await RefreshSession.countDocuments({ userId: user._id })).toBe(
            1
        );
        expect(
            await AuditLog.countDocuments({ action: "EMAIL_VERIFIED" })
        ).toBe(1);

        await ctx.emailService.whenSettled();
        const [welcome] = ctx.outbox.find({
            to: user.email,
            templateKey: "welcome",
        });
        expect(welcome.data.link).toBe("http://localhost:5173/onboarding");
        // the first device is recorded silently
        expect(ctx.outbox.find({ templateKey: "new-device" })).toHaveLength(0);
    });

    it("works once: a reused token is VERIFY_TOKEN_INVALID", async () => {
        const ctx = makeAuthCtx();
        const { token } = await pendingUser();
        await verifyEmail({ token }, ctx);
        await expect(verifyEmail({ token }, ctx)).rejects.toMatchObject({
            statusCode: 400,
            code: "VERIFY_TOKEN_INVALID",
        });
    });

    it("two concurrent verifications: exactly one wins", async () => {
        const ctx = makeAuthCtx();
        const { token } = await pendingUser();
        const results = await Promise.allSettled([
            verifyEmail({ token }, ctx),
            verifyEmail({ token }, ctx),
        ]);
        expect(
            results.filter((result) => result.status === "fulfilled")
        ).toHaveLength(1);
        expect(await RefreshSession.countDocuments({})).toBe(1);
    });

    it.each([
        ["unknown", () => "u".repeat(43)],
        ["malformed", () => "not a token!"],
        [
            "of another type",
            async () =>
                (
                    await issueEmailToken({
                        type: AUTH_TOKEN_TYPES.PASSWORD_RESET,
                        userId: (await createUser())._id,
                        email: "x@example.test",
                    })
                ).token,
        ],
    ])(
        "rejects a %s token with the same generic code",
        async (_label, make) => {
            await expect(
                verifyEmail({ token: await make() }, makeAuthCtx())
            ).rejects.toMatchObject({
                statusCode: 400,
                code: "VERIFY_TOKEN_INVALID",
            });
        }
    );

    it("rejects an expired token (24 hours, fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { token } = await pendingUser();
        vi.setSystemTime(new Date("2026-10-27T09:59:00Z"));
        await expect(
            verifyEmail({ token }, makeAuthCtx())
        ).resolves.toBeTruthy();
        const second = await pendingUser();
        vi.setSystemTime(new Date("2026-10-28T10:01:00Z"));
        await expect(
            verifyEmail({ token: second.token }, makeAuthCtx())
        ).rejects.toMatchObject({ code: "VERIFY_TOKEN_INVALID" });
    });

    it("rejects a token whose address no longer matches the user (wrong user / changed email)", async () => {
        const { user, token } = await pendingUser();
        await User.updateOne(
            { _id: user._id },
            { email: "changed@example.test" }
        );
        await expect(
            verifyEmail({ token }, makeAuthCtx())
        ).rejects.toMatchObject({ code: "VERIFY_TOKEN_INVALID" });
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "pending_verification",
        });
    });

    it("does not activate a suspended account and does not burn the token", async () => {
        const { user, token } = await pendingUser();
        await User.updateOne({ _id: user._id }, { status: "suspended" });
        await expect(
            verifyEmail({ token }, makeAuthCtx())
        ).rejects.toMatchObject({ code: "VERIFY_TOKEN_INVALID" });
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "suspended",
        });
        expect(
            (await AuthToken.findOne({ userId: user._id }).lean()).usedAt
        ).toBeNull();
    });
});

describe("resendVerification (AUTH-30)", () => {
    const resend = async (ctx, email, now) => {
        resendVerification({ email }, ctx, now);
        await whenBackgroundIdle();
        await ctx.emailService.whenSettled();
    };

    it("returns before doing any work (the caller never waits for the lookup)", async () => {
        const ctx = makeAuthCtx();
        const { user } = await pendingUser();
        expect(resendVerification({ email: user.email }, ctx)).toBeUndefined();
        expect(ctx.outbox.all()).toHaveLength(0);
        await whenBackgroundIdle();
    });

    it("sends a new link and invalidates the previous one", async () => {
        const ctx = makeAuthCtx();
        const { user, token: oldToken } = await pendingUser();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 61_000);
        await resend(ctx, user.email);
        const newToken = latestToken(
            ctx.emailService,
            user.email,
            "verify-email"
        );
        expect(newToken).toBeTruthy();
        expect(newToken).not.toBe(oldToken);
        await expect(
            verifyEmail({ token: oldToken }, ctx)
        ).rejects.toMatchObject({ code: "VERIFY_TOKEN_INVALID" });
        await expect(
            verifyEmail({ token: newToken }, ctx)
        ).resolves.toBeTruthy();
    });

    it("stays silent for unknown, active and suspended addresses", async () => {
        const ctx = makeAuthCtx();
        const active = await createUser();
        const suspended = await createUser({ status: "suspended" });
        for (const email of [
            "nobody@example.test",
            active.email,
            suspended.email,
        ])
            await resend(ctx, email);
        expect(ctx.outbox.all()).toHaveLength(0);
        expect(await AuthToken.countDocuments({})).toBe(0);
    });

    it("enforces the 60 second cooldown silently", async () => {
        const ctx = makeAuthCtx();
        const { user } = await pendingUser();
        const issuedAt = (await AuthToken.findOne({ userId: user._id }).lean())
            .createdAt;
        await resend(ctx, user.email, new Date(issuedAt.getTime() + 59_000));
        expect(ctx.outbox.all()).toHaveLength(0);
        await resend(ctx, user.email, new Date(issuedAt.getTime() + 61_000));
        expect(ctx.outbox.all()).toHaveLength(1);
    });

    it("enforces the cap of 5 per hour silently, counting the original token", async () => {
        const ctx = makeAuthCtx();
        const { user } = await pendingUser();
        let t = Date.now();
        for (let i = 0; i < 6; i += 1) {
            t += 61_000;
            await resend(ctx, user.email, new Date(t));
        }
        expect(ctx.outbox.all()).toHaveLength(4);
        expect(await AuthToken.countDocuments({ userId: user._id })).toBe(5);
        // an hour later the allowance is back
        await resend(
            ctx,
            user.email,
            new Date(Date.now() + 3_600_000 + 120_000)
        );
        expect(ctx.outbox.all()).toHaveLength(5);
    });
});
