import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { User } from "#modules/users/user.model.js";
import { makeUser } from "#tests/factories/user.factory.js";
import { fromOtherDevice, makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { RefreshSession } from "./refreshSession.model.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";
import { hashRefreshToken } from "./tokens.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

describe("signInUser", () => {
    it("creates a session, access/refresh/csrf credentials and a token-free user summary", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(
            makeUser({ passwordHash: "stored-hash" })
        );
        const result = await signInUser({
            user,
            ctx,
            remember: true,
            notifyDevice: false,
        });

        expect(result.session).toMatchObject({ remember: true });
        expect(result.session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(result.session.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const claims = jwt.decode(result.session.accessToken);
        expect(claims).toMatchObject({
            sub: String(user._id),
            role: "learner",
            tv: 0,
        });

        const row = await RefreshSession.findOne({ userId: user._id })
            .select("+tokenHash")
            .lean();
        expect(row.tokenHash).toBe(
            hashRefreshToken(result.session.refreshToken)
        );
        expect(row.familyId).toBe(claims.sid);
        expect(row.remember).toBe(true);

        expect(result).toMatchObject({
            needsOnboarding: false,
            reactivate: false,
        });
        expect(result.user).toMatchObject({
            id: String(user._id),
            email: user.email,
            hasPassword: true,
        });
        expect(JSON.stringify(result.user)).not.toMatch(
            /passwordHash|stored-hash|tokenVersion|knownDevice/
        );
    });

    it("records lastLoginAt and audits LOGIN_SUCCESS with the method", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(makeUser());
        const now = new Date("2026-10-26T10:00:00Z");
        await signInUser({
            user,
            ctx,
            method: SIGN_IN_METHODS.GOOGLE,
            notifyDevice: false,
            now,
        });
        expect((await User.findById(user._id).lean()).lastLoginAt).toEqual(now);
        const [event] = await AuditLog.find({ action: "LOGIN_SUCCESS" })
            .limit(2)
            .lean();
        expect(event.meta).toEqual({
            method: "google",
            limited: false,
            remember: false,
        });
        expect(String(event.actorId)).toBe(String(user._id));
    });

    it("sends the new-device mail only for an unseen device and only when asked to", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(makeUser());
        await signInUser({ user, ctx, notifyDevice: false });
        await signInUser({ user, ctx });
        await signInUser({
            user,
            ctx: fromOtherDevice(ctx, "SecondBrowser/1.0"),
        });
        await ctx.emailService.whenSettled();
        expect(ctx.outbox.find({ templateKey: "new-device" })).toHaveLength(1);
    });

    it("gives a must-change-password user only a limited access token: no refresh token, no session row (AUTH-38)", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(makeUser({ mustChangePassword: true }));
        const result = await signInUser({ user, ctx });
        expect(result.session.refreshToken).toBeUndefined();
        expect(result.session.accessToken).toBeTruthy();
        expect(jwt.decode(result.session.accessToken)).not.toHaveProperty(
            "sid"
        );
        expect(await RefreshSession.countDocuments({})).toBe(0);
        expect(result.user.mustChangePassword).toBe(true);
        const [event] = await AuditLog.find({ action: "LOGIN_SUCCESS" })
            .limit(2)
            .lean();
        expect(event.meta.limited).toBe(true);
    });

    it("passes the reactivate flag through and flags missing consent as needing onboarding", async () => {
        const ctx = makeAuthCtx();
        const user = await User.create(
            makeUser({ termsAcceptedAt: undefined })
        );
        const result = await signInUser({
            user,
            ctx,
            reactivate: true,
            notifyDevice: false,
        });
        expect(result).toMatchObject({
            reactivate: true,
            needsOnboarding: true,
        });
    });
});
