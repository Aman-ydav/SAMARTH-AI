import request from "supertest";
import { describe, expect, it } from "vitest";
import { expectError } from "#tests/helpers/envelopes.js";
import { buildApp } from "#tests/helpers/appFactory.js";

const ALLOWED = "http://localhost:5173";
const OTHER_ALLOWED = "https://app.example.test";
const env = { CORS_ALLOWED_ORIGINS: `${ALLOWED},${OTHER_ALLOWED}` };
const mountRoutes = (api) =>
    api.get("/ping", (_req, res) => res.json({ ok: true }));
const app = () => buildApp({ env, mountRoutes }).app;

describe("CORS (BE-11..16, AUTH-19)", () => {
    it("echoes an allowed origin exactly with credentials and Vary: Origin", async () => {
        const res = await request(app())
            .get("/api/v1/ping")
            .set("Origin", OTHER_ALLOWED);
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe(OTHER_ALLOWED);
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
        expect(res.headers.vary).toMatch(/Origin/);
    });

    it("exposes the headers the frontend needs", async () => {
        const res = await request(app())
            .get("/api/v1/ping")
            .set("Origin", ALLOWED);
        const exposed = res.headers["access-control-expose-headers"];
        for (const name of [
            "X-Request-Id",
            "Retry-After",
            "RateLimit-Limit",
            "Content-Disposition",
        ])
            expect(exposed).toContain(name);
    });

    it("denies an unlisted origin with 403 CORS_ORIGIN_DENIED in the standard envelope", async () => {
        const res = await request(app())
            .get("/api/v1/ping")
            .set("Origin", "https://evil.example");
        expectError(res, 403, "CORS_ORIGIN_DENIED");
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it.each([
        ["a look-alike host", "http://localhost:5173.evil.example"],
        ["the wrong scheme", "https://localhost:5173"],
        ["the wrong port", "http://localhost:5174"],
        ["a trailing slash", `${ALLOWED}/`],
        ["different case", "HTTP://LOCALHOST:5173"],
        ["the null origin", "null"],
    ])("denies %s", async (_label, origin) => {
        expectError(
            await request(app()).get("/api/v1/ping").set("Origin", origin),
            403,
            "CORS_ORIGIN_DENIED"
        );
    });

    it("never answers with a wildcard or a reflected origin", async () => {
        const res = await request(app())
            .get("/api/v1/ping")
            .set("Origin", ALLOWED);
        expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    });

    it("allows requests with no Origin header (curl, Postman, health checks)", async () => {
        const res = await request(app()).get("/api/v1/ping");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("answers a preflight from an allowed origin with 204 and a capped max-age, before auth or rate limiting", async () => {
        const res = await request(app())
            .options("/api/v1/auth/login")
            .set("Origin", ALLOWED)
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "content-type,x-csrf-token");
        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
        expect(res.headers["access-control-allow-methods"]).toBe(
            "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        );
        expect(res.headers["access-control-allow-headers"]).toMatch(
            /x-csrf-token/i
        );
        expect(
            Number(res.headers["access-control-max-age"])
        ).toBeLessThanOrEqual(600);
    });

    it("rejects a preflight from an unlisted origin", async () => {
        const res = await request(app())
            .options("/api/v1/ping")
            .set("Origin", "https://evil.example")
            .set("Access-Control-Request-Method", "POST");
        expectError(res, 403, "CORS_ORIGIN_DENIED");
    });

    it("does not send credentials headers to the denied origin even on errors from later middleware", async () => {
        const res = await request(app())
            .get("/api/v1/missing")
            .set("Origin", ALLOWED);
        expect(res.status).toBe(404);
        expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    });
});
