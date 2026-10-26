import jwt from "jsonwebtoken";
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
import { makeUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { RefreshSession } from "./refreshSession.model.js";
import { refreshSession, rotateRefreshToken } from "./refresh.service.js";
import { createSession, revokeFamily } from "./session.service.js";
import { hashRefreshToken } from "./tokens.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const T0 = new Date("2026-10-26T10:00:00Z");
const after = (ms) => new Date(T0.getTime() + ms);

let ctx;
beforeEach(() => {
    ctx = makeAuthCtx();
});

async function startedSession(overrides = {}, remember = false) {
    const user = await User.create(makeUser(overrides));
    const session = await createSession({ user, ctx, remember, now: T0 });
    return { user, ...session };
}
const familyRows = (familyId) =>
    RefreshSession.find({ familyId })
        .select("+tokenHash")
        .sort({ createdAt: 1 })
        .limit(20)
        .lean();

describe("rotateRefreshToken: normal rotation (AUTH-06)", () => {
    it("revokes the old row as rotated, links it to the new one and keeps the family", async () => {
        const { user, familyId, refreshToken } = await startedSession();
        const result = await rotateRefreshToken({
            refreshToken,
            ctx,
            now: after(1000),
        });
        expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(result.refreshToken).not.toBe(refreshToken);
        expect(result).toMatchObject({
            grace: false,
            familyId,
            remember: false,
        });
        expect(String(result.user._id)).toBe(String(user._id));

        const [oldRow, newRow] = await familyRows(familyId);
        expect(oldRow).toMatchObject({ revokedReason: "rotated" });
        expect(oldRow.revokedAt).toEqual(after(1000));
        expect(String(oldRow.replacedBy)).toBe(String(newRow._id));
        expect(newRow.revokedAt).toBeNull();
        expect(newRow.tokenHash).toBe(hashRefreshToken(result.refreshToken));
    });

    it("slides the expiry by 7 days from the refresh but never past the 30 day absolute cap (R6)", async () => {
        const { familyId, refreshToken } = await startedSession();
        let token = refreshToken;
        for (const day of [1, 7, 13, 19]) {
            token = (
                await rotateRefreshToken({
                    refreshToken: token,
                    ctx,
                    now: after(day * DAY),
                })
            ).refreshToken;
            const [latest] = (await familyRows(familyId)).slice(-1);
            expect(latest.expiresAt).toEqual(after((day + 7) * DAY));
        }
        await rotateRefreshToken({
            refreshToken: token,
            ctx,
            now: after(25 * DAY),
        });
        const last = (await familyRows(familyId)).at(-1);
        expect(last.expiresAt).toEqual(after(30 * DAY));
        expect(last.absoluteExpiresAt).toEqual(after(30 * DAY));
    });

    it("remember-me slides by 30 days up to a 90 day cap", async () => {
        const { familyId, refreshToken } = await startedSession({}, true);
        await rotateRefreshToken({ refreshToken, ctx, now: after(10 * DAY) });
        const rows = await familyRows(familyId);
        expect(rows.at(-1).expiresAt).toEqual(after(40 * DAY));
        expect(rows.at(-1).remember).toBe(true);
    });

    it("records the current device on the new row", async () => {
        const { familyId, refreshToken } = await startedSession();
        const other = makeAuthCtx({
            userAgent: "Second Browser/2.0",
            ip: "198.51.100.9",
        });
        await rotateRefreshToken({
            refreshToken,
            ctx: { ...other, config: ctx.config },
            now: after(1000),
        });
        const rows = await familyRows(familyId);
        expect(rows.at(-1)).toMatchObject({
            userAgent: "Second Browser/2.0",
            userAgentHash: other.userAgentHash,
        });
    });
});

describe("rotateRefreshToken: every failure is REFRESH_INVALID", () => {
    const expectInvalid = (promise) =>
        expect(promise).rejects.toMatchObject({
            statusCode: 401,
            code: "REFRESH_INVALID",
        });

    it.each([undefined, null, "", 42, "x".repeat(201), "unknown-token-value"])(
        "for the token %j",
        async (value) => {
            await startedSession();
            await expectInvalid(
                rotateRefreshToken({ refreshToken: value, ctx, now: T0 })
            );
        }
    );

    it("for an expired row", async () => {
        const { refreshToken } = await startedSession();
        await expectInvalid(
            rotateRefreshToken({
                refreshToken,
                ctx,
                now: after(7 * DAY + 1000),
            })
        );
    });

    it("for a row past its absolute cap even if its own expiry was extended", async () => {
        const { familyId, refreshToken } = await startedSession();
        // absoluteExpiresAt is immutable for Mongoose, so tamper with it through the native driver
        await RefreshSession.collection.updateMany(
            { familyId },
            {
                $set: {
                    expiresAt: after(100 * DAY),
                    absoluteExpiresAt: after(DAY),
                },
            }
        );
        await expectInvalid(
            rotateRefreshToken({ refreshToken, ctx, now: after(2 * DAY) })
        );
    });

    it("for a logged-out session, without raising the reuse alarm", async () => {
        const { user, familyId, refreshToken } = await startedSession();
        await revokeFamily(familyId, "logout", { now: T0 });
        await expectInvalid(
            rotateRefreshToken({ refreshToken, ctx, now: after(60_000) })
        );
        await ctx.emailService.whenSettled();
        expect(ctx.outbox.find({ to: user.email })).toHaveLength(0);
        expect(
            await AuditLog.countDocuments({ action: "TOKEN_REUSE_DETECTED" })
        ).toBe(0);
    });

    it.each(["suspended", "deactivated", "pending_deletion"])(
        "for a %s user, and the family is revoked",
        async (status) => {
            const { user, familyId, refreshToken } = await startedSession();
            await User.updateOne({ _id: user._id }, { status });
            await expectInvalid(
                rotateRefreshToken({ refreshToken, ctx, now: after(1000) })
            );
            expect(
                await RefreshSession.countDocuments({
                    familyId,
                    revokedAt: null,
                })
            ).toBe(0);
        }
    );
});

describe("rotateRefreshToken: grace window and reuse detection (AUTH-07, AUTH-08)", () => {
    it("inside 10 seconds a rotated token yields grace: no new refresh token, no alarm, family intact", async () => {
        const { user, familyId, refreshToken } = await startedSession();
        const first = await rotateRefreshToken({
            refreshToken,
            ctx,
            now: after(1000),
        });
        const second = await rotateRefreshToken({
            refreshToken,
            ctx,
            now: after(1000 + 10_000),
        });
        expect(second).toMatchObject({
            grace: true,
            refreshToken: null,
            familyId,
        });
        expect(String(second.user._id)).toBe(String(user._id));
        expect(await RefreshSession.countDocuments({ familyId })).toBe(2);
        expect(
            await RefreshSession.countDocuments({ familyId, revokedAt: null })
        ).toBe(1);
        // the successor still works
        await expect(
            rotateRefreshToken({
                refreshToken: first.refreshToken,
                ctx,
                now: after(12_000),
            })
        ).resolves.toMatchObject({ grace: false });
        expect(
            await AuditLog.countDocuments({ action: "TOKEN_REUSE_DETECTED" })
        ).toBe(0);
    });

    it("after the window the old token is theft: the whole family is revoked, audited and the owner mailed", async () => {
        const { user, familyId, refreshToken } = await startedSession();
        const first = await rotateRefreshToken({
            refreshToken,
            ctx,
            now: after(1000),
        });
        await expect(
            rotateRefreshToken({ refreshToken, ctx, now: after(1000 + 10_001) })
        ).rejects.toMatchObject({ statusCode: 401, code: "REFRESH_INVALID" });

        const rows = await familyRows(familyId);
        expect(rows.every((row) => row.revokedAt)).toBe(true);
        expect(rows.at(-1).revokedReason).toBe("reuse_detected");
        // the thief's successor token is dead too
        await expect(
            rotateRefreshToken({
                refreshToken: first.refreshToken,
                ctx,
                now: after(30_000),
            })
        ).rejects.toMatchObject({ code: "REFRESH_INVALID" });

        const events = await AuditLog.find({ action: "TOKEN_REUSE_DETECTED" })
            .limit(5)
            .lean();
        expect(events).toHaveLength(1);
        expect(events[0].meta).toEqual({ familyId });
        await ctx.emailService.whenSettled();
        const [alert] = ctx.outbox.find({
            to: user.email,
            templateKey: "token-reuse-alert",
        });
        expect(alert.data.resetLink).toMatch(/\/forgot-password$/);
    });

    it("treats the 10 second boundary as inside the window", async () => {
        const { refreshToken } = await startedSession();
        await rotateRefreshToken({ refreshToken, ctx, now: after(0) });
        const edge = await rotateRefreshToken({
            refreshToken,
            ctx,
            now: after(10_000),
        });
        expect(edge.grace).toBe(true);
    });

    it("a replayed token whose family was already revoked is just invalid (no alarm)", async () => {
        const { familyId, refreshToken } = await startedSession();
        await rotateRefreshToken({ refreshToken, ctx, now: after(1000) });
        await revokeFamily(familyId, "logout", { now: after(2000) });
        await expect(
            rotateRefreshToken({ refreshToken, ctx, now: after(60_000) })
        ).rejects.toMatchObject({ code: "REFRESH_INVALID" });
        expect(
            await AuditLog.countDocuments({ action: "TOKEN_REUSE_DETECTED" })
        ).toBe(0);
    });

    it("grace never revives a family that was logged out meanwhile", async () => {
        const { familyId, refreshToken } = await startedSession();
        await rotateRefreshToken({ refreshToken, ctx, now: after(1000) });
        await revokeFamily(familyId, "logout", { now: after(2000) });
        await expect(
            rotateRefreshToken({ refreshToken, ctx, now: after(3000) })
        ).rejects.toMatchObject({ code: "REFRESH_INVALID" });
    });

    it("two concurrent refreshes with the same token: exactly one rotates, the other gets grace", async () => {
        const { familyId, refreshToken } = await startedSession();
        const results = await Promise.all([
            rotateRefreshToken({ refreshToken, ctx, now: after(1000) }),
            rotateRefreshToken({ refreshToken, ctx, now: after(1000) }),
            rotateRefreshToken({ refreshToken, ctx, now: after(1000) }),
        ]);
        expect(results.filter((result) => !result.grace)).toHaveLength(1);
        expect(results.filter((result) => result.grace)).toHaveLength(2);
        expect(
            await RefreshSession.countDocuments({ familyId, revokedAt: null })
        ).toBe(1);
        expect(await RefreshSession.countDocuments({ familyId })).toBe(2);
    });
});

describe("refreshSession (credentials for the cookies)", () => {
    const decode = (token) => jwt.decode(token);

    it("returns a fresh access token for the same family plus a new refresh and csrf token", async () => {
        const { user, familyId, refreshToken } = await startedSession();
        const result = await refreshSession({
            refreshToken,
            ctx,
            now: after(1000),
        });
        expect(result).toMatchObject({ grace: false, remember: false });
        expect(result.refreshToken).not.toBe(refreshToken);
        expect(result.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(decode(result.accessToken)).toMatchObject({
            sub: String(user._id),
            sid: familyId,
            tv: 0,
        });
    });

    it("carries the CURRENT token version and role from the database", async () => {
        const { user, refreshToken } = await startedSession();
        await User.updateOne(
            { _id: user._id },
            { $inc: { tokenVersion: 2 }, role: "trainer" }
        );
        const result = await refreshSession({
            refreshToken,
            ctx,
            now: after(1000),
        });
        expect(decode(result.accessToken)).toMatchObject({
            tv: 2,
            role: "trainer",
        });
    });

    it("in the grace window returns only an access token", async () => {
        const { refreshToken } = await startedSession();
        await refreshSession({ refreshToken, ctx, now: after(1000) });
        const second = await refreshSession({
            refreshToken,
            ctx,
            now: after(2000),
        });
        expect(second).toEqual({
            accessToken: expect.any(String),
            grace: true,
        });
    });
});
