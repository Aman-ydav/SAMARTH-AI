// Supertest route-table tests (TEST-08): guards, CSRF, verbs, rate limits and wiring of the whole /auth router.
import request from "supertest";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createApp } from "#app";
import { createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError } from "#tests/helpers/envelopes.js";
import { AUTH_LIMITS } from "./auth.constants.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const API = "/api/v1/auth";
const SOME_ID = "64b7f0f0f0f0f0f0f0f0f0f1";

// Every route of doc 08 section 3.1 (the frontend-only "GET /verify-email" row is not an API route).
const ROUTES = [
    { method: "post", path: "/register", auth: false },
    { method: "post", path: "/verify-email", auth: false },
    { method: "post", path: "/resend-verification", auth: false },
    { method: "post", path: "/login", auth: false },
    { method: "post", path: "/google", auth: false },
    { method: "delete", path: "/google", auth: true },
    { method: "post", path: "/refresh", auth: false },
    { method: "post", path: "/logout", auth: false },
    { method: "post", path: "/logout-all", auth: true },
    { method: "get", path: "/me", auth: true },
    { method: "post", path: "/forgot-password", auth: false },
    { method: "post", path: "/reset-password/validate", auth: false },
    { method: "post", path: "/reset-password", auth: false },
    { method: "post", path: "/change-password", auth: true },
    { method: "post", path: "/change-email", auth: true },
    { method: "post", path: "/change-email/confirm", auth: false },
    { method: "post", path: "/change-email/undo", auth: false },
    { method: "get", path: "/sessions", auth: true },
    { method: "delete", path: `/sessions/${SOME_ID}`, auth: true },
    { method: "delete", path: "/account", auth: true },
    { method: "post", path: "/accept-invite", auth: false },
];
const UNSAFE = ROUTES.filter((route) => route.method !== "get");
const PROTECTED = ROUTES.filter((route) => route.auth);

describe("route table", () => {
    it("covers the 21 API routes of doc 08 (22 rows minus the frontend-only page)", () => {
        expect(ROUTES).toHaveLength(21);
    });

    it.each(
        PROTECTED.map((route) => [
            `${route.method.toUpperCase()} ${route.path}`,
            route,
        ])
    )(
        "%s answers 401 AUTH_REQUIRED without the access cookie",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const response = await agent[route.method](
                `${API}${route.path}`
            ).send({});
            expectError(response, 401, "AUTH_REQUIRED");
        }
    );

    it.each(
        UNSAFE.map((route) => [
            `${route.method.toUpperCase()} ${route.path}`,
            route,
        ])
    )(
        "%s answers 403 CSRF_INVALID without the X-CSRF-Token header (login, register and forgot are not exempt)",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const response = await agent.agent[route.method](
                `${API}${route.path}`
            ).send({});
            expectError(response, 403, "CSRF_INVALID");
        }
    );

    it.each(
        UNSAFE.map((route) => [
            `${route.method.toUpperCase()} ${route.path}`,
            route,
        ])
    )(
        "%s answers 403 CSRF_INVALID when the header does not match the cookie",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const response = await agent.agent[route.method](
                `${API}${route.path}`
            )
                .set("X-CSRF-Token", "m".repeat(43))
                .send({});
            expectError(response, 403, "CSRF_INVALID");
        }
    );

    it("rejects a disallowed Origin with 403 CORS_ORIGIN_DENIED, also on refresh (CORS answers before any route)", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        for (const path of ["/login", "/refresh"]) {
            const response = await agent
                .post(`${API}${path}`)
                .set("Origin", "https://evil.example.test")
                .send({});
            expectError(response, 403, "CORS_ORIGIN_DENIED");
        }
    });

    it("accepts the configured Origin", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/logout`)
            .set("Origin", "http://localhost:5173");
        expect(response.status).toBe(200);
    });

    it.each(
        UNSAFE.filter((route) => route.method === "post").map((route) => [
            route.path,
            route,
        ])
    )(
        "POST-only: GET %s does not exist (404), so a mail scanner cannot consume anything",
        async (_name, route) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            expectError(
                await agent.get(`${API}${route.path}`),
                404,
                "NOT_FOUND"
            );
        }
    );

    it("sends Cache-Control: no-store on auth responses", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expect(
            (await agent.post(`${API}/logout`)).headers["cache-control"]
        ).toBe("no-store");
        expect((await agent.get(`${API}/me`)).headers["cache-control"]).toBe(
            "no-store"
        );
    });

    it("refuses an unknown top-level key on every JSON route (strict schemas)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        for (const route of UNSAFE.filter(
            (item) =>
                !["/refresh", "/logout"].includes(item.path) &&
                !item.path.startsWith("/sessions")
        )) {
            const response = await agent[route.method](
                `${API}${route.path}`
            ).send({ returnTo: "https://evil.example.test" });
            expect(response.status, `${route.method} ${route.path}`).toBe(400);
            expect(response.body.code).toBe("VALIDATION_ERROR");
        }
    });
});

describe("wiring in the real application", () => {
    it("createApp mounts /auth and /profile with their own guards", async () => {
        const app = createApp({ readinessCheck: async () => true });
        const me = await request(app).get(`${API}/me`);
        expectError(me, 401, "AUTH_REQUIRED");
        const profile = await request(app).get("/api/v1/profile");
        expectError(profile, 401, "AUTH_REQUIRED");
        expectError(await request(app).get(`${API}/nope`), 404, "NOT_FOUND");
    });
});

describe("rate limits (AUTH-40, doc 08 section 10)", () => {
    const hit = async (agent, method, path, times, body = {}) => {
        let last;
        for (let i = 0; i < times; i += 1)
            last = await agent[method](`${API}${path}`).send(body);
        return last;
    };
    const expectLimited = (response) => {
        const error = expectError(response, 429, "RATE_LIMITED");
        expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
        expect(error.retryAfterSec).toBeGreaterThan(0);
    };

    it.each([
        ["register", "/register", AUTH_LIMITS.register.limit],
        ["verify-email", "/verify-email", AUTH_LIMITS.verifyEmail.limit],
        [
            "resend-verification",
            "/resend-verification",
            AUTH_LIMITS.resendVerification.limit,
        ],
        ["google", "/google", AUTH_LIMITS.google.limit],
        ["refresh", "/refresh", AUTH_LIMITS.refresh.limit],
        ["forgot-password", "/forgot-password", AUTH_LIMITS.forgotIp.limit],
        ["reset-password", "/reset-password", AUTH_LIMITS.reset.limit],
        [
            "change-email/confirm",
            "/change-email/confirm",
            AUTH_LIMITS.changeEmailToken.limit,
        ],
        ["accept-invite", "/accept-invite", AUTH_LIMITS.acceptInvite.limit],
    ])(
        "%s: allows %i requests per IP, then 429 RATE_LIMITED with Retry-After",
        async (_name, path, limit) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const within = await hit(agent, "post", path, limit);
            expect(within.status).not.toBe(429);
            expectLimited(await agent.post(`${API}${path}`).send({}));
        }
    );

    it("login: 10 per IP per 15 minutes", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        for (let i = 0; i < 10; i += 1) {
            const response = await agent
                .post(`${API}/login`)
                .send({ email: `person${i}@example.test`, password: "x" });
            expect(response.status).toBe(401);
        }
        expectLimited(
            await agent
                .post(`${API}/login`)
                .send({ email: "person99@example.test", password: "x" })
        );
    });

    it("login: 10 per email key, and the per-email limit is NOT relaxed by RATE_LIMIT_IP_MULTIPLIER (R10)", async () => {
        const { app } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "5" },
        });
        const user = await createUser();
        for (let i = 0; i < 10; i += 1) {
            const agent = await createAuthAgent(app);
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: "x".repeat(i + 1) });
        }
        const agent = await createAuthAgent(app);
        expectLimited(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email.toUpperCase(), password: "x" })
        );
        // another address from the same IP is still fine
        expect(
            (
                await agent
                    .post(`${API}/login`)
                    .send({ email: "other.person@example.test", password: "x" })
            ).status
        ).toBe(401);
    });

    it("RATE_LIMIT_IP_MULTIPLIER raises the per-IP limits only", async () => {
        const { app } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "3" },
        });
        const agent = await createAuthAgent(app);
        const within = await hit(agent, "post", "/register", 15);
        expect(within.status).not.toBe(429);
        expectLimited(await agent.post(`${API}/register`).send({}));
    });

    it("keeps the per-IP counters of different routes apart", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        await hit(agent, "post", "/register", AUTH_LIMITS.register.limit + 1);
        expect(
            (
                await agent
                    .post(`${API}/forgot-password`)
                    .send({ email: "a@example.test" })
            ).status
        ).toBe(200);
    });

    it.each([
        [
            "change-password",
            "post",
            "/change-password",
            AUTH_LIMITS.changePassword.limit,
        ],
        [
            "change-email",
            "post",
            "/change-email",
            AUTH_LIMITS.changeEmail.limit,
        ],
        ["unlink google", "delete", "/google", AUTH_LIMITS.unlinkGoogle.limit],
        [
            "delete account",
            "delete",
            "/account",
            AUTH_LIMITS.deleteAccount.limit,
        ],
    ])(
        "%s: per-USER limit of %i per hour, never relaxed by the IP multiplier",
        async (_name, method, path, limit) => {
            const { app } = buildAuthApp({
                env: { RATE_LIMIT_IP_MULTIPLIER: "10" },
            });
            const user = await createUser();
            const { agent } = await loginAs(app, user.email);
            const within = await hit(agent, method, path, limit);
            expect(within.status).toBe(400);
            expectLimited(await agent[method](`${API}${path}`).send({}));
            // another user is unaffected
            const other = await createUser();
            const second = await loginAs(app, other.email);
            expect(
                (await second.agent[method](`${API}${path}`).send({})).status
            ).toBe(400);
        }
    );
});
