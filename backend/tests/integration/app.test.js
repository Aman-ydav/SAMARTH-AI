import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "#app";
import { validate } from "#middlewares/validate.js";
import { ApiResponse } from "#utils/apiResponse.js";
import {
    buildApp,
    createCsrfAgent,
    request,
} from "#tests/helpers/appFactory.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";

const mountRoutes = (api) => {
    api.get("/echo", (req, res) =>
        ApiResponse.ok({ query: { ...req.query } }).send(res)
    );
    api.post(
        "/echo",
        validate({ body: z.object({ name: z.string().min(1) }) }),
        (req, res) => ApiResponse.created(req.validated.body).send(res)
    );
    api.post("/raw", (req, res) =>
        ApiResponse.ok({ raw: req.rawBody ?? null }).send(res)
    );
    api.post("/media/webhook", (req, res) =>
        ApiResponse.ok({ raw: req.rawBody ?? null, parsed: req.body }).send(res)
    );
};
const make = (options = {}) => buildApp({ mountRoutes, ...options });

describe("health and readiness (BE-05)", () => {
    it("GET /health is 200 and unauthenticated, outside /api/v1", async () => {
        const body = expectSuccess(
            await request(make().app).get("/health"),
            200
        );
        expect(body.data.status).toBe("ok");
    });

    it("GET /ready is 200 when ready and 503 with Retry-After when not", async () => {
        expectSuccess(await request(make().app).get("/ready"), 200);
        const res = await request(
            make({ readinessCheck: async () => false }).app
        ).get("/ready");
        expectError(res, 503, "INTEGRATION_ERROR");
        expect(res.headers["retry-after"]).toBeDefined();
    });

    it("health and ready are never rate limited and need no CSRF cookie", async () => {
        const { app } = make({ env: { RATE_LIMIT_MAX: "1" } });
        for (let i = 0; i < 4; i += 1)
            expect((await request(app).get("/health")).status).toBe(200);
        for (let i = 0; i < 4; i += 1)
            expect((await request(app).get("/ready")).status).toBe(200);
        expect(
            (await request(app).get("/health")).headers["set-cookie"]
        ).toBeUndefined();
    });

    it("do not appear under the API prefix", async () => {
        expectError(
            await request(make().app).get("/api/v1/health"),
            404,
            "NOT_FOUND"
        );
    });
});

describe("security headers (BE-60)", () => {
    it("are present on every response, including errors", async () => {
        const { app } = make();
        for (const res of [
            await request(app).get("/health"),
            await request(app).get("/nope"),
        ]) {
            expect(res.headers["x-content-type-options"]).toBe("nosniff");
            expect(res.headers["content-security-policy"]).toContain(
                "default-src 'none'"
            );
            expect(res.headers["referrer-policy"]).toBe("no-referrer");
            expect(res.headers["x-powered-by"]).toBeUndefined();
            expect(res.headers["x-request-id"]).toBeDefined();
        }
    });

    it("marks API responses uncacheable and sends HSTS only in production", async () => {
        expect(
            (await request(make().app).get("/api/v1/echo")).headers[
                "cache-control"
            ]
        ).toBe("no-store");
        expect(
            (await request(make().app).get("/health")).headers[
                "strict-transport-security"
            ]
        ).toBeUndefined();
        expect(
            (
                await request(
                    make({ env: { NODE_ENV: "production" } }).app
                ).get("/health")
            ).headers["strict-transport-security"]
        ).toContain("max-age");
    });
});

describe("error envelopes at app level (TEST-11)", () => {
    it("unknown route -> 404 envelope with request id", async () => {
        const res = await request(make().app).get("/api/v1/does/not/exist");
        const body = expectError(res, 404, "NOT_FOUND");
        expect(body.message).toBe("Route not found");
        expectError(
            await request(make().app).get("/totally-unknown"),
            404,
            "NOT_FOUND"
        );
    });

    it("malformed JSON -> 400 INVALID_JSON", async () => {
        const res = await request(make().app)
            .post("/api/v1/echo")
            .set("Content-Type", "application/json")
            .send('{"name": "x",');
        const body = expectError(res, 400, "INVALID_JSON");
        expect(JSON.stringify(body)).not.toMatch(/Unexpected|position|token/i);
    });

    it("body over 100 KB -> 413 PAYLOAD_TOO_LARGE", async () => {
        const res = await request(make().app)
            .post("/api/v1/echo")
            .send({ name: "x".repeat(120 * 1024) });
        expectError(res, 413, "PAYLOAD_TOO_LARGE");
    });

    it("a body just under the limit is accepted by the parser", async () => {
        const csrf = await createCsrfAgent(make().app);
        const res = await csrf
            .post("/api/v1/echo")
            .send({ name: "x".repeat(90 * 1024) });
        expect(res.status).toBe(201);
    });

    it("malformed percent-encoding in the URL -> a clean error envelope, not a crash", async () => {
        const res = await request(make().app).get("/api/v1/echo/%E0%A4%A");
        expect([400, 404]).toContain(res.status);
        expect(res.body.success).toBe(false);
    });

    it("unsupported content type leaves the body empty and fails validation", async () => {
        const csrf = await createCsrfAgent(make().app);
        const res = await csrf
            .post("/api/v1/echo")
            .set("Content-Type", "text/plain")
            .send("name=x");
        expectError(res, 400, "VALIDATION_ERROR");
    });
});

describe("input sanitising and validation end to end", () => {
    it("NoSQL operators in a login-style body are stripped and then fail validation", async () => {
        const csrf = await createCsrfAgent(make().app);
        expectError(
            await csrf.post("/api/v1/echo").send({ name: { $ne: null } }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("operator keys in the query never reach the handler (Express 5 read-only req.query)", async () => {
        const res = await request(make().app).get(
            "/api/v1/echo?a=1&$where=1&b.c=2"
        );
        expect(res.body.data.query).toEqual({ a: "1" });
    });

    it("rejects unknown body keys instead of mass-assigning them", async () => {
        const csrf = await createCsrfAgent(make().app);
        expectError(
            await csrf.post("/api/v1/echo").send({ name: "x", role: "admin" }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("accepts a valid request and returns the success envelope", async () => {
        const csrf = await createCsrfAgent(make().app);
        const body = expectSuccess(
            await csrf.post("/api/v1/echo").send({ name: "Asha" }),
            201
        );
        expect(body.data).toEqual({ name: "Asha" });
    });
});

describe("raw body capture for signed webhooks (MEDIA-15)", () => {
    it("keeps the exact bytes on the webhook path, which is CSRF exempt", async () => {
        const text = '{"b":2,  "a":1}';
        const res = await request(make().app)
            .post("/api/v1/media/webhook")
            .set("Content-Type", "application/json")
            .send(text);
        expect(res.body.data).toEqual({ raw: text, parsed: { b: 2, a: 1 } });
    });

    it("does not retain raw bodies for other routes", async () => {
        const csrf = await createCsrfAgent(make().app);
        const res = await csrf.post("/api/v1/raw").send({ a: 1 });
        expect(res.body.data.raw).toBeNull();
    });
});

describe("rate limiting wiring (BE-61)", () => {
    it("applies the global limiter to API routes and answers 429 with Retry-After", async () => {
        const { app } = make({ env: { RATE_LIMIT_MAX: "2" } });
        await request(app).get("/api/v1/echo");
        await request(app).get("/api/v1/echo");
        const res = await request(app).get("/api/v1/echo");
        expectError(res, 429, "RATE_LIMITED");
        expect(res.headers["retry-after"]).toBeDefined();
    });

    it("applies RATE_LIMIT_IP_MULTIPLIER to the global limiter in non-production environments", async () => {
        const { app } = make({
            env: { RATE_LIMIT_MAX: "1", RATE_LIMIT_IP_MULTIPLIER: "3" },
        });
        const statuses = [];
        for (let i = 0; i < 4; i += 1)
            statuses.push((await request(app).get("/api/v1/echo")).status);
        expect(statuses).toEqual([200, 200, 200, 429]);
    });
});

describe("routing details", () => {
    it("routing is case sensitive, so alternate casings cannot dodge guards", async () => {
        const { app } = make();
        expect((await request(app).get("/api/v1/echo")).status).toBe(200);
        expect((await request(app).get("/api/v1/ECHO")).status).toBe(404);
        expect((await request(app).get("/HEALTH")).status).toBe(404);
    });

    it("works without options (validated env and an empty module list)", async () => {
        const app = createApp();
        expectError(
            await request(app).get("/api/v1/anything"),
            404,
            "NOT_FOUND"
        );
        expect((await request(app).get("/health")).status).toBe(200);
    });

    it("a request id sent by the client is echoed in the header and the error body", async () => {
        const res = await request(make().app)
            .get("/nope")
            .set("X-Request-Id", "trace-me-123456");
        expect(res.headers["x-request-id"]).toBe("trace-me-123456");
        expect(res.body.requestId).toBe("trace-me-123456");
    });
});
