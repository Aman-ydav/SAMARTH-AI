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
import { signAccessToken } from "#utils/accessToken.js";
import { RefreshSession } from "#modules/auth/refreshSession.model.js";
import { createSession, revokeFamily } from "#modules/auth/session.service.js";
import { User } from "#modules/users/user.model.js";
import { makeUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import {
    createAuthenticate,
    authenticate,
    authenticateAllowLimited,
} from "./authenticate.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const ctx = makeAuthCtx();
const run = (middleware, cookies) =>
    new Promise((resolve) => {
        const req = { cookies };
        middleware(req, {}, (error) => resolve({ error, req }));
    });

async function signedInUser(overrides = {}) {
    const user = await User.create(makeUser(overrides));
    const { familyId } = await createSession({ user, ctx });
    const token = (patch = {}) =>
        signAccessToken({
            userId: user._id,
            role: user.role,
            orgId: user.orgId,
            sid: familyId,
            tokenVersion: user.tokenVersion,
            ...patch,
        });
    return { user, familyId, token };
}

describe("authenticate: reading the cookie", () => {
    it.each([undefined, "", 42, ["a"]])(
        "answers AUTH_REQUIRED when sai_access is %j",
        async (value) => {
            const { error } = await run(
                authenticate,
                value === undefined ? {} : { sai_access: value }
            );
            expect(error).toMatchObject({
                statusCode: 401,
                code: "AUTH_REQUIRED",
            });
        }
    );

    it("answers AUTH_REQUIRED when there are no cookies at all", async () => {
        const { error } = await run(authenticate, undefined);
        expect(error.code).toBe("AUTH_REQUIRED");
    });

    it("answers TOKEN_INVALID for a garbled token and for a token signed with another secret", async () => {
        const { error } = await run(authenticate, { sai_access: "not.a.jwt" });
        expect(error).toMatchObject({ name: "JsonWebTokenError" });
        const { token } = await signedInUser();
        const forged = token().slice(0, -3) + "abc";
        expect(
            (await run(authenticate, { sai_access: forged })).error
        ).toMatchObject({ name: "JsonWebTokenError" });
    });

    it("answers TokenExpiredError (mapped to TOKEN_EXPIRED) once the 15 minutes have passed", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const { token } = await signedInUser();
        const issued = token();
        vi.setSystemTime(Date.now() + 15 * 60_000 + 2000);
        const { error } = await run(authenticate, { sai_access: issued });
        expect(error).toMatchObject({ name: "TokenExpiredError" });
    });
});

describe("authenticate: database checks", () => {
    it("accepts a valid token and sets req.auth and req.user from the database", async () => {
        const { user, familyId, token } = await signedInUser({
            role: "trainer",
        });
        const { error, req } = await run(authenticate, { sai_access: token() });
        expect(error).toBeUndefined();
        expect(req.auth).toEqual({
            id: String(user._id),
            userId: String(user._id),
            role: "trainer",
            orgId: String(user.orgId),
            sid: familyId,
            tokenVersion: 0,
            limited: false,
        });
        expect(req.user).toBe(req.auth);
    });

    it("takes the role from the database, not from the token (AUTH-59)", async () => {
        const { user, token } = await signedInUser({ role: "learner" });
        await User.updateOne({ _id: user._id }, { role: "admin" });
        const { req } = await run(authenticate, {
            sai_access: token({ role: "learner" }),
        });
        expect(req.auth.role).toBe("admin");
    });

    it("rejects a token whose tv differs from the user's (role change, password change)", async () => {
        const { user, token } = await signedInUser();
        await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
        const { error } = await run(authenticate, { sai_access: token() });
        expect(error).toMatchObject({ statusCode: 401, code: "TOKEN_INVALID" });
    });

    it("rejects a token for a user that no longer exists", async () => {
        const { user, token } = await signedInUser();
        await User.deleteOne({ _id: user._id });
        expect(
            (await run(authenticate, { sai_access: token() })).error.code
        ).toBe("TOKEN_INVALID");
    });

    it("rejects a revoked session with SESSION_REVOKED", async () => {
        const { familyId, token } = await signedInUser();
        await revokeFamily(familyId, "logout");
        const { error } = await run(authenticate, { sai_access: token() });
        expect(error).toMatchObject({
            statusCode: 401,
            code: "SESSION_REVOKED",
        });
    });

    it("rejects an expired session row and a session of another family", async () => {
        const { familyId, token } = await signedInUser();
        await RefreshSession.updateMany(
            { familyId },
            { expiresAt: new Date(Date.now() - 1000) }
        );
        expect(
            (await run(authenticate, { sai_access: token() })).error.code
        ).toBe("SESSION_REVOKED");
        const other = await signedInUser();
        expect(
            (
                await run(authenticate, {
                    sai_access: other.token({ sid: familyId }),
                })
            ).error.code
        ).toBe("SESSION_REVOKED");
    });

    it.each([
        ["suspended", 403, "ACCOUNT_SUSPENDED"],
        ["deactivated", 403, "ACCOUNT_DEACTIVATED"],
        ["pending_deletion", 401, "SESSION_REVOKED"],
        ["pending_verification", 401, "SESSION_REVOKED"],
        ["deleted", 401, "SESSION_REVOKED"],
    ])("rejects a %s account with %i %s", async (status, statusCode, code) => {
        const { user, token } = await signedInUser();
        await User.updateOne({ _id: user._id }, { status });
        const { error } = await run(authenticate, { sai_access: token() });
        expect(error).toMatchObject({ statusCode, code });
    });
});

describe("authenticate: limited (must-change-password) sessions (AUTH-38)", () => {
    const limitedToken = (user) =>
        signAccessToken({
            userId: user._id,
            role: user.role,
            orgId: user.orgId,
            tokenVersion: user.tokenVersion,
        });

    it("refuses a limited token on ordinary routes and accepts it where limited sessions are allowed", async () => {
        const user = await User.create(makeUser({ mustChangePassword: true }));
        const cookies = { sai_access: limitedToken(user) };
        expect((await run(authenticate, cookies)).error).toMatchObject({
            statusCode: 403,
            code: "MUST_CHANGE_PASSWORD",
        });
        const allowed = await run(authenticateAllowLimited, cookies);
        expect(allowed.error).toBeUndefined();
        expect(allowed.req.auth).toMatchObject({ limited: true, sid: null });
    });

    it("refuses a limited token when the user no longer has the flag", async () => {
        const user = await User.create(makeUser());
        const { error } = await run(authenticateAllowLimited, {
            sai_access: limitedToken(user),
        });
        expect(error.code).toBe("TOKEN_INVALID");
    });

    it("also blocks a full session of a user who is now flagged, except where limited sessions are allowed", async () => {
        const { user, token } = await signedInUser();
        await User.updateOne({ _id: user._id }, { mustChangePassword: true });
        expect(
            (await run(authenticate, { sai_access: token() })).error.code
        ).toBe("MUST_CHANGE_PASSWORD");
        expect(
            (await run(authenticateAllowLimited, { sai_access: token() })).error
        ).toBeUndefined();
    });

    it("createAuthenticate uses the config it is given", async () => {
        const { token } = await signedInUser();
        const other = createAuthenticate({ config: makeOtherConfig() });
        expect((await run(other, { sai_access: token() })).error).toMatchObject(
            { name: "JsonWebTokenError" }
        );
    });
});

function makeOtherConfig() {
    return {
        ...ctx.config,
        auth: { ...ctx.config.auth, accessSecret: "z".repeat(48) },
    };
}
