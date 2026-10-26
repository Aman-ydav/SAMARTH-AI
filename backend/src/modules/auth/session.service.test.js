import mongoose from "mongoose";
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
import { makeUser } from "#tests/factories/user.factory.js";
import { fromOtherDevice, makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { User } from "#modules/users/user.model.js";
import { RefreshSession } from "./refreshSession.model.js";
import {
    createSession,
    findLiveFamily,
    listSessions,
    revokeAllSessions,
    revokeByRefreshTokenHash,
    revokeFamily,
    revokeOwnSession,
    toSessionView,
} from "./session.service.js";
import { hashRefreshToken } from "./tokens.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const ctx = makeAuthCtx();
const newUser = () => User.create(makeUser());
const rows = (filter = {}) =>
    RefreshSession.find(filter).select("+tokenHash").limit(50).lean();

describe("createSession", () => {
    it("stores only the keyed hash, a hashed ip, a truncated user agent and a stable family id", async () => {
        const user = await newUser();
        const longAgent = "A".repeat(300);
        const { familyId, refreshToken } = await createSession({
            user,
            ctx: { ...ctx, userAgent: longAgent.slice(0, 200) },
        });
        const [row] = await rows();
        expect(familyId).toMatch(/^[a-f0-9]{24}$/);
        expect(row.tokenHash).toBe(hashRefreshToken(refreshToken));
        expect(JSON.stringify(row)).not.toContain(refreshToken);
        expect(row.userAgent).toHaveLength(200);
        expect(row.ipHash).toBe(ctx.ipHash);
        expect(row).toMatchObject({ remember: false, revokedAt: null });
        expect(String(row.orgId)).toBe(String(user.orgId));
    });

    it("normal session: 7 day sliding window, 30 day absolute cap (R6)", async () => {
        const now = new Date("2026-10-26T10:00:00Z");
        await createSession({ user: await newUser(), ctx, now });
        const [row] = await rows();
        expect(row.expiresAt.getTime() - now.getTime()).toBe(7 * DAY);
        expect(row.absoluteExpiresAt.getTime() - now.getTime()).toBe(30 * DAY);
    });

    it("remember-me: 30 day sliding window, 90 day absolute cap (R6)", async () => {
        const now = new Date("2026-10-26T10:00:00Z");
        await createSession({
            user: await newUser(),
            ctx,
            remember: true,
            now,
        });
        const [row] = await rows();
        expect(row.remember).toBe(true);
        expect(row.expiresAt.getTime() - now.getTime()).toBe(30 * DAY);
        expect(row.absoluteExpiresAt.getTime() - now.getTime()).toBe(90 * DAY);
    });

    it("revokes the oldest session when an 11th is created (AUTH-10)", async () => {
        const user = await newUser();
        const families = [];
        for (let i = 0; i < 11; i += 1) {
            const { familyId } = await createSession({
                user,
                ctx,
                now: new Date(Date.now() + i * 1000),
            });
            families.push(familyId);
        }
        const live = await rows({ revokedAt: null });
        expect(live).toHaveLength(10);
        const revoked = await rows({ familyId: families[0] });
        expect(revoked[0]).toMatchObject({ revokedReason: "logout" });
        expect(live.map((row) => row.familyId)).not.toContain(families[0]);
    });

    it("does not count other users' sessions toward the cap", async () => {
        const [one, two] = [await newUser(), await newUser()];
        for (let i = 0; i < 10; i += 1) await createSession({ user: one, ctx });
        await createSession({ user: two, ctx });
        expect(
            await RefreshSession.countDocuments({
                userId: one._id,
                revokedAt: null,
            })
        ).toBe(10);
    });
});

describe("listSessions and toSessionView", () => {
    it("lists live sessions with a device label, start time, last use and the current flag", async () => {
        const user = await newUser();
        const chrome = fromOtherDevice(
            ctx,
            "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36"
        );
        const first = await createSession({
            user,
            ctx: chrome,
            now: new Date("2026-10-26T08:00:00Z"),
        });
        const second = await createSession({
            user,
            ctx: fromOtherDevice(ctx, "curl/8.4.0"),
            now: new Date("2026-10-26T09:00:00Z"),
        });
        const items = await listSessions(user._id, second.familyId);
        expect(items.map((item) => item.id)).toEqual([
            second.familyId,
            first.familyId,
        ]);
        expect(items[0]).toMatchObject({ device: "curl", current: true });
        expect(items[1]).toMatchObject({
            device: "Chrome on Windows",
            current: false,
        });
        expect(items[1].createdAt).toEqual(new Date("2026-10-26T08:00:00Z"));
        expect(JSON.stringify(items)).not.toMatch(/tokenHash|ipHash/);
    });

    it("hides revoked and expired sessions and other users' sessions", async () => {
        const user = await newUser();
        const stranger = await newUser();
        const live = await createSession({ user, ctx });
        const revoked = await createSession({ user, ctx });
        const expired = await createSession({ user, ctx });
        await createSession({ user: stranger, ctx });
        await revokeFamily(revoked.familyId, "logout");
        await RefreshSession.updateMany(
            { familyId: expired.familyId },
            { expiresAt: new Date(Date.now() - 1000) }
        );
        const items = await listSessions(user._id, null);
        expect(items.map((item) => item.id)).toEqual([live.familyId]);
    });

    it("derives the start time from the remember-me cap", () => {
        const absoluteExpiresAt = new Date("2026-12-01T00:00:00Z");
        const view = toSessionView(
            {
                familyId: "f",
                remember: true,
                absoluteExpiresAt,
                createdAt: new Date(),
            },
            "other"
        );
        expect(view.createdAt).toEqual(
            new Date(absoluteExpiresAt.getTime() - 90 * DAY)
        );
        expect(view.current).toBe(false);
    });
});

describe("revoking", () => {
    it("revokeOwnSession revokes every row of the family", async () => {
        const user = await newUser();
        const { familyId } = await createSession({ user, ctx });
        await revokeOwnSession(user._id, familyId);
        expect(await findLiveFamily(familyId, user._id)).toBeNull();
        expect((await rows({ familyId }))[0].revokedReason).toBe("logout");
    });

    it("answers 404 for a foreign, unknown or already revoked session (BE-42)", async () => {
        const user = await newUser();
        const stranger = await newUser();
        const { familyId } = await createSession({ user, ctx });
        await expect(
            revokeOwnSession(stranger._id, familyId)
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
            revokeOwnSession(
                user._id,
                new mongoose.Types.ObjectId().toHexString()
            )
        ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
        await revokeFamily(familyId, "logout");
        await expect(
            revokeOwnSession(user._id, familyId)
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(await findLiveFamily(familyId, stranger._id)).toBeNull();
    });

    it("revokeAllSessions can keep one family and returns how many rows it revoked", async () => {
        const user = await newUser();
        const keep = await createSession({ user, ctx });
        await createSession({ user, ctx });
        await createSession({ user, ctx });
        const revoked = await revokeAllSessions(user._id, "password_change", {
            exceptFamilyId: keep.familyId,
        });
        expect(revoked).toBe(2);
        expect(await findLiveFamily(keep.familyId, user._id)).toBeTruthy();
        expect(await revokeAllSessions(user._id, "logout_all")).toBe(1);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
    });

    it("revokeByRefreshTokenHash revokes the family of a known token and ignores unknown ones", async () => {
        const user = await newUser();
        const { familyId, refreshToken } = await createSession({ user, ctx });
        expect(
            await revokeByRefreshTokenHash(hashRefreshToken("unknown"))
        ).toBeNull();
        expect(
            await revokeByRefreshTokenHash(hashRefreshToken(refreshToken))
        ).toBe(familyId);
        expect(await findLiveFamily(familyId, user._id)).toBeNull();
        expect(
            await revokeByRefreshTokenHash(hashRefreshToken(refreshToken))
        ).toBe(familyId);
    });

    it("findLiveFamily is false once the row expired", async () => {
        const user = await newUser();
        const { familyId } = await createSession({ user, ctx });
        await RefreshSession.updateMany(
            { familyId },
            { expiresAt: new Date(Date.now() - 1) }
        );
        expect(await findLiveFamily(familyId, user._id)).toBeNull();
    });
});
