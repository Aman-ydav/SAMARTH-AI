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
import { RefreshSession } from "#modules/auth/refreshSession.model.js";
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent, rawRequest } from "#tests/helpers/authAgent.js";
import { createSession } from "#modules/auth/session.service.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { cookiesOf } from "#tests/helpers/setCookie.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const DAY = 86_400_000;

const refreshWith = (app, token) =>
    rawRequest(app, "post", `${API}/refresh`, {
        cookies: { sai_refresh: token },
    });
const loginCookies = async (app, user, extra = {}) => {
    const response = await rawRequest(app, "post", `${API}/login`, {
        body: { email: user.email, password: TEST_PASSWORD, ...extra },
    });
    expect(response.status).toBe(200);
    return cookiesOf(response);
};

describe("POST /auth/refresh: rotation (AUTH-06)", () => {
    it("issues new access, refresh and csrf cookies and the old refresh token stops working after the grace window", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const { app } = buildAuthApp();
        const user = await createUser();
        const first = await loginCookies(app, user);
        vi.setSystemTime(Date.now() + 1000);
        const response = await refreshWith(app, first.sai_refresh.value);
        expectSuccess(response);
        const second = cookiesOf(response);
        expect(second.sai_refresh.value).not.toBe(first.sai_refresh.value);
        expect(second.sai_access.value).not.toBe(first.sai_access.value);
        expect(second.sai_csrf.value).not.toBe(first.sai_csrf.value);
        expect(second.sai_refresh).toMatchObject({
            httpOnly: true,
            path: "/api/v1/auth",
            maxAge: 7 * 86_400,
        });

        vi.setSystemTime(Date.now() + 11_000);
        expectError(
            await refreshWith(app, first.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
    });

    it("keeps the same session: the new access token carries the same sid, and /me works", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        const sid = jwt.decode(agent.cookie("sai_access")).sid;
        expectSuccess(await agent.post(`${API}/refresh`));
        expect(jwt.decode(agent.cookie("sai_access")).sid).toBe(sid);
        expectSuccess(await agent.get(`${API}/me`));
        expect(await RefreshSession.countDocuments({ userId: user._id })).toBe(
            2
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(1);
    });

    it("answers REFRESH_INVALID for a missing, empty, unknown or oversized cookie", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(await agent.post(`${API}/refresh`), 401, "REFRESH_INVALID");
        for (const token of ["", "unknown-token", "x".repeat(500)]) {
            expectError(await refreshWith(app, token), 401, "REFRESH_INVALID");
        }
    });

    it("answers REFRESH_INVALID for an expired or revoked session", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const expired = await loginCookies(app, user);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 7 * DAY + 1000);
        expectError(
            await refreshWith(app, expired.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
        vi.useRealTimers();

        const revoked = await loginCookies(app, user);
        await RefreshSession.updateMany(
            { userId: user._id },
            { revokedAt: new Date(), revokedReason: "logout" }
        );
        expectError(
            await refreshWith(app, revoked.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
    });

    it("never tells why: the response for every failure is the same body", async () => {
        const { app } = buildAuthApp();
        const bodies = [];
        for (const token of [undefined, "unknown-token"]) {
            const response = await rawRequest(app, "post", `${API}/refresh`, {
                cookies: token ? { sai_refresh: token } : {},
            });
            const { requestId: _ignored, ...rest } = expectError(
                response,
                401,
                "REFRESH_INVALID"
            );
            bodies.push(rest);
        }
        expect(bodies[0]).toEqual(bodies[1]);
    });

    it("refuses a suspended user and ends the session", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const cookies = await loginCookies(app, user);
        await User.updateOne({ _id: user._id }, { status: "suspended" });
        expectError(
            await refreshWith(app, cookies.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
    });
});

describe("reuse detection and the 10 second grace window (AUTH-07, AUTH-08)", () => {
    it("a rotated token replayed after 10 s revokes the whole family, audits, mails the owner and kills the access token", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const first = await loginCookies(app, user);
        const second = cookiesOf(
            await refreshWith(app, first.sai_refresh.value)
        );

        vi.setSystemTime(Date.now() + 10_500);
        expectError(
            await refreshWith(app, first.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );

        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        expectError(
            await refreshWith(app, second.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
        const me = await rawRequest(app, "get", `${API}/me`, {
            cookies: { sai_access: second.sai_access.value },
        });
        expectError(me, 401, "SESSION_REVOKED");
        expect(
            await AuditLog.countDocuments({ action: "TOKEN_REUSE_DETECTED" })
        ).toBe(1);
        await emailService.whenSettled();
        expect(
            emailService.outbox.find({
                to: user.email,
                templateKey: "token-reuse-alert",
            })
        ).toHaveLength(1);
    });

    it("inside the window a replayed token gets a fresh access cookie only: no new refresh cookie, no alarm", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const first = await loginCookies(app, user);
        expectSuccess(await refreshWith(app, first.sai_refresh.value));
        const replay = await refreshWith(app, first.sai_refresh.value);
        expectSuccess(replay);
        const cookies = cookiesOf(replay);
        expect(cookies.sai_access.value).toBeTruthy();
        expect(cookies.sai_refresh).toBeUndefined();
        expect(cookies.sai_csrf).toBeUndefined();
        await emailService.whenSettled();
        expect(
            emailService.outbox.find({ templateKey: "token-reuse-alert" })
        ).toHaveLength(0);
        expect(
            await AuditLog.countDocuments({ action: "TOKEN_REUSE_DETECTED" })
        ).toBe(0);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(1);
    });

    it("concurrent multi-tab refreshes with one token all succeed and exactly one rotates", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const first = await loginCookies(app, user);
        const responses = await Promise.all(
            Array.from({ length: 4 }, () =>
                refreshWith(app, first.sai_refresh.value)
            )
        );
        expect(responses.map((response) => response.status)).toEqual([
            200, 200, 200, 200,
        ]);
        const rotated = responses.filter(
            (response) => cookiesOf(response).sai_refresh
        );
        expect(rotated).toHaveLength(1);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(1);
    });
});

describe("lifetimes (R6)", () => {
    async function ageRefresh(app, user, extra, stepDays, untilDays) {
        vi.useFakeTimers({ toFake: ["Date"] });
        const start = Date.now();
        let token = (await loginCookies(app, user, extra)).sai_refresh.value;
        let day = 0;
        let last = { status: 200 };
        while (day + stepDays <= untilDays) {
            day += stepDays;
            vi.setSystemTime(start + day * DAY);
            last = await refreshWith(app, token);
            if (last.status !== 200) break;
            token = cookiesOf(last).sai_refresh.value;
        }
        return { last, day, token, start };
    }

    it("a normal session survives while used every 6 days, but dies at the 30 day absolute cap", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { last, day, token, start } = await ageRefresh(
            app,
            user,
            {},
            6,
            24
        );
        expect(day).toBe(24);
        expect(last.status).toBe(200);
        // day 29: the sliding window would give day 36, the cap clamps the row to day 30
        vi.setSystemTime(start + 29 * DAY);
        const near = await refreshWith(app, token);
        expect(near.status).toBe(200);
        const live = await RefreshSession.findOne({
            userId: user._id,
            revokedAt: null,
        }).lean();
        expect(live.expiresAt.getTime()).toBe(start + 30 * DAY);
        expect(live.absoluteExpiresAt.getTime()).toBe(start + 30 * DAY);
        vi.setSystemTime(start + 30 * DAY + 1000);
        expectError(
            await refreshWith(app, cookiesOf(near).sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
    });

    it("a normal session dies after 7 idle days (sliding window)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { last } = await ageRefresh(app, user, {}, 8, 8);
        expect(last.status).toBe(401);
    });

    it("remember-me slides by 30 days and is capped at 90 days", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { last, day, token, start } = await ageRefresh(
            app,
            user,
            { rememberMe: true },
            25,
            90
        );
        expect(day).toBe(75);
        expect(last.status).toBe(200);
        vi.setSystemTime(start + 89 * DAY);
        const final = await refreshWith(app, token);
        expect(final.status).toBe(200);
        const live = await RefreshSession.findOne({
            userId: user._id,
            revokedAt: null,
        }).lean();
        expect(live.expiresAt.getTime()).toBe(start + 90 * DAY);
        expect(cookiesOf(final).sai_refresh.maxAge).toBe(30 * 86_400);
        vi.setSystemTime(start + 90 * DAY + 1000);
        expectError(
            await refreshWith(app, cookiesOf(final).sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
    });

    it("expired rows stay in the database for the 30 day audit grace (the TTL index, not the code, removes them)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const cookies = await loginCookies(app, user);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 8 * DAY);
        expectError(
            await refreshWith(app, cookies.sai_refresh.value),
            401,
            "REFRESH_INVALID"
        );
        expect(await RefreshSession.countDocuments({ userId: user._id })).toBe(
            1
        );
        const indexes = await RefreshSession.collection.indexes();
        expect(
            indexes.find(
                (index) => index.name === "refreshSessions_expiresAt_ttl"
            ).expireAfterSeconds
        ).toBe(30 * 86_400);
    });
});

describe("sessions and token versions", () => {
    it("the 11th session revokes the oldest one (AUTH-10); the login that created it works", async () => {
        const { app, config } = buildAuthApp();
        const user = await createUser();
        const ctx = { ...makeAuthCtx(), config };
        const families = [];
        for (let i = 0; i < 10; i += 1) {
            families.push((await createSession({ user, ctx })).familyId);
            await new Promise((resolve) => setTimeout(resolve, 3));
        }
        const { agent } = await loginAs(app, user.email);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(10);
        expect(
            await RefreshSession.countDocuments({
                familyId: families[0],
                revokedAt: null,
            })
        ).toBe(0);
        expect(
            await RefreshSession.countDocuments({
                familyId: families[1],
                revokedAt: null,
            })
        ).toBe(1);
        expectSuccess(await agent.get(`${API}/me`));
    });

    it("a role change bumps tv: the old access token is TOKEN_INVALID, refresh returns the new claims", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        await User.updateOne(
            { _id: user._id },
            { role: "trainer", $inc: { tokenVersion: 1 } }
        );
        expectError(await agent.get(`${API}/me`), 401, "TOKEN_INVALID");
        expectSuccess(await agent.post(`${API}/refresh`));
        expect(jwt.decode(agent.cookie("sai_access"))).toMatchObject({
            role: "trainer",
            tv: 1,
        });
        expect(expectSuccess(await agent.get(`${API}/me`)).data.user.role).toBe(
            "trainer"
        );
    });
});
