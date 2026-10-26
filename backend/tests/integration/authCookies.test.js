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
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent, rawRequest } from "#tests/helpers/authAgent.js";
import { buildAuthApp } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { cookiesOf } from "#tests/helpers/setCookie.js";
import { expectSuccess } from "#tests/helpers/envelopes.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const REFRESH_PATH = "/api/v1/auth";
const DAY = 86_400;

const login = (app, email, extra = {}, options = {}) =>
    rawRequest(app, "post", `${API}/login`, {
        body: { email, password: TEST_PASSWORD, ...extra },
        ...options,
    });

describe("cookie flags (AUTH-02, AUTH-03, TEST-10)", () => {
    it("sets sai_access, sai_refresh and sai_csrf with the documented attributes", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const cookies = cookiesOf(await login(app, user.email));
        expect(cookies.sai_access).toMatchObject({
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 900,
            secure: false,
        });
        expect(cookies.sai_refresh).toMatchObject({
            httpOnly: true,
            sameSite: "lax",
            path: REFRESH_PATH,
            maxAge: 7 * DAY,
            secure: false,
        });
        expect(cookies.sai_csrf).toMatchObject({
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * DAY,
            secure: false,
        });
        expect(cookies.sai_access.domain).toBeUndefined();
    });

    it("remember-me changes only the refresh and csrf lifetimes (30 days); access stays 15 minutes (AUTH-09)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const cookies = cookiesOf(
            await login(app, user.email, { rememberMe: true })
        );
        expect(cookies.sai_access.maxAge).toBe(900);
        expect(cookies.sai_refresh.maxAge).toBe(30 * DAY);
        expect(cookies.sai_csrf.maxAge).toBe(30 * DAY);
    });

    it("adds Secure to all three cookies in production", async () => {
        const { app } = buildAuthApp({ env: { NODE_ENV: "production" } });
        const user = await createUser();
        const cookies = cookiesOf(await login(app, user.email));
        for (const name of ["sai_access", "sai_refresh", "sai_csrf"]) {
            expect(cookies[name].secure, name).toBe(true);
            expect(cookies[name].sameSite, name).toBe("lax");
        }
        expect(cookies.sai_access.httpOnly).toBe(true);
        expect(cookies.sai_refresh.httpOnly).toBe(true);
        expect(cookies.sai_csrf.httpOnly).toBe(false);
    });

    it("split-origin fallback: SameSite=None needs Secure and a shared COOKIE_DOMAIN (R13)", async () => {
        const { app } = buildAuthApp({
            env: { COOKIE_SAMESITE: "none", COOKIE_DOMAIN: ".example.test" },
        });
        const user = await createUser();
        const cookies = cookiesOf(await login(app, user.email));
        for (const name of ["sai_access", "sai_refresh", "sai_csrf"]) {
            expect(cookies[name]).toMatchObject({
                sameSite: "none",
                secure: true,
                domain: ".example.test",
            });
        }
    });

    it("never puts a token in any response body (login, refresh, verify via Google)", async () => {
        const verify = vi
            .fn()
            .mockResolvedValue({
                sub: "g-5",
                email: "g5@example.test",
                name: "G Five",
            });
        const { app } = buildAuthApp({ verifyGoogleCredential: verify });
        const user = await createUser();
        const loginResponse = await login(app, user.email);
        const access = cookiesOf(loginResponse).sai_access.value;
        const refresh = cookiesOf(loginResponse).sai_refresh.value;
        const refreshed = await rawRequest(app, "post", `${API}/refresh`, {
            cookies: { sai_refresh: refresh },
        });
        const google = await rawRequest(app, "post", `${API}/google`, {
            body: { credential: "google-credential-value" },
        });
        for (const response of [loginResponse, refreshed, google]) {
            const text = JSON.stringify(response.body);
            expect(text).not.toContain(access);
            expect(text).not.toContain(refresh);
            expect(text).not.toMatch(/sai_|accessToken|refreshToken|Bearer/i);
        }
    });
});

describe("csrf cookie (AUTH-16)", () => {
    it("is issued on the very first response of any request, before login", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expect(agent.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(agent.cookie("sai_csrf")).toBe(agent.csrf);
    });

    it("rotates on login, refresh and logout", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        const initial = agent.csrf;
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        const afterLogin = agent.csrf;
        expect(afterLogin).not.toBe(initial);
        expectSuccess(await agent.post(`${API}/refresh`));
        const afterRefresh = agent.csrf;
        expect(afterRefresh).not.toBe(afterLogin);
        const logout = await agent.post(`${API}/logout`);
        expect(cookiesOf(logout).sai_csrf.value).toBe("");
    });

    it("keeps working with the new value after rotation (old value is refused)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        const stale = agent.csrf;
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        expect(
            (
                await agent.agent
                    .post(`${API}/refresh`)
                    .set("X-CSRF-Token", stale)
            ).status
        ).toBe(403);
        expect((await agent.post(`${API}/refresh`)).status).toBe(200);
    });
});

describe("clearing (AUTH-12)", () => {
    it("logout clears each cookie with the same name, path, flags and a past expiry", async () => {
        const { app } = buildAuthApp({ env: { NODE_ENV: "production" } });
        const user = await createUser();
        const loginResponse = await login(app, user.email);
        const set = cookiesOf(loginResponse);
        const response = await rawRequest(app, "post", `${API}/logout`, {
            cookies: {
                sai_access: set.sai_access.value,
                sai_refresh: set.sai_refresh.value,
            },
        });
        const cleared = cookiesOf(response);
        for (const name of ["sai_access", "sai_refresh", "sai_csrf"]) {
            expect(cleared[name].value, name).toBe("");
            expect(cleared[name].expires.getTime(), name).toBeLessThan(
                Date.now()
            );
            expect(cleared[name].path, name).toBe(set[name].path);
            expect(cleared[name].httpOnly, name).toBe(set[name].httpOnly);
            expect(cleared[name].secure, name).toBe(set[name].secure);
            expect(cleared[name].sameSite, name).toBe(set[name].sameSite);
        }
    });

    it("a browser jar really drops the cookies after logout", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        expect(agent.cookie("sai_access")).toBeTruthy();
        await agent.post(`${API}/logout`);
        expect(agent.cookie("sai_access")).toBeUndefined();
        expect(agent.cookie("sai_refresh", REFRESH_PATH)).toBeUndefined();
        expect(agent.cookie("sai_csrf")).toBeUndefined();
    });

    it("the refresh cookie is sent only to /api/v1/auth, not to other paths", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        expect(
            agent.cookie("sai_refresh", "/api/v1/auth/refresh")
        ).toBeTruthy();
        expect(agent.cookie("sai_refresh", "/api/v1/profile")).toBeUndefined();
        expect(agent.cookie("sai_refresh", "/")).toBeUndefined();
    });
});
