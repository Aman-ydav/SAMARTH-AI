import { describe, expect, it, vi } from "vitest";
import {
    buildApp,
    createCsrfAgent,
    readSetCookie,
    request,
    setCookieLine,
} from "#tests/helpers/appFactory.js";
import { expectError } from "#tests/helpers/envelopes.js";
import { csrfProtection } from "./csrf.js";

const ORIGIN = "http://localhost:5173";
const mountRoutes = (api) => {
    api.get("/thing", (_req, res) => res.json({ ok: true }));
    api.post("/thing", (_req, res) => res.json({ ok: true }));
    api.put("/thing", (_req, res) => res.json({ ok: true }));
    api.patch("/thing", (_req, res) => res.json({ ok: true }));
    api.delete("/thing", (_req, res) => res.json({ ok: true }));
    api.post("/media/webhook", (_req, res) => res.json({ webhook: true }));
    api.post("/media/webhook-lookalike", (_req, res) => res.json({ ok: true }));
};
const app = (env = {}) => buildApp({ env, mountRoutes }).app;

describe("CSRF issuing (AUTH-16)", () => {
    it("sets sai_csrf on a GET that lacks it: JS-readable, Lax, path /", async () => {
        const res = await request(app()).get("/api/v1/thing");
        const line = setCookieLine(res, "sai_csrf");
        expect(line).toBeDefined();
        expect(line).toMatch(/Path=\//);
        expect(line).toMatch(/SameSite=Lax/i);
        expect(line).not.toMatch(/HttpOnly/i);
        expect(readSetCookie(res, "sai_csrf")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("does not rotate a valid cookie the client already holds", async () => {
        const csrf = await createCsrfAgent(app());
        const again = await csrf.get("/api/v1/thing");
        expect(readSetCookie(again, "sai_csrf")).toBeUndefined();
    });

    it("re-issues a malformed cookie", async () => {
        const res = await request(app())
            .get("/api/v1/thing")
            .set("Cookie", "sai_csrf=short");
        expect(readSetCookie(res, "sai_csrf")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("issues a cookie even on a 404 so the first POST can follow any earlier call", async () => {
        const res = await request(app()).get("/api/v1/does-not-exist");
        expect(res.status).toBe(404);
        expect(readSetCookie(res, "sai_csrf")).toBeDefined();
    });
});

describe("CSRF enforcement on unsafe methods (AUTH-17)", () => {
    it.each(["post", "put", "patch", "delete"])(
        "accepts %s with a matching header",
        async (method) => {
            const csrf = await createCsrfAgent(app());
            const res = await csrf[method]("/api/v1/thing");
            expect(res.status).toBe(200);
        }
    );

    it.each(["post", "put", "patch", "delete"])(
        "rejects %s without the header: 403 CSRF_INVALID",
        async (method) => {
            const csrf = await createCsrfAgent(app());
            expectError(
                await csrf.agent[method]("/api/v1/thing"),
                403,
                "CSRF_INVALID"
            );
        }
    );

    it("rejects a header that differs from the cookie", async () => {
        const csrf = await createCsrfAgent(app());
        expectError(
            await csrf.agent
                .post("/api/v1/thing")
                .set("X-CSRF-Token", `${csrf.token.slice(0, -1)}x`),
            403,
            "CSRF_INVALID"
        );
    });

    it("rejects a header of a different length without throwing", async () => {
        const csrf = await createCsrfAgent(app());
        expectError(
            await csrf.agent.post("/api/v1/thing").set("X-CSRF-Token", "short"),
            403,
            "CSRF_INVALID"
        );
    });

    it("rejects a header when the cookie is missing (cannot be forged by sending only the header)", async () => {
        expectError(
            await request(app())
                .post("/api/v1/thing")
                .set("X-CSRF-Token", "a".repeat(43)),
            403,
            "CSRF_INVALID"
        );
    });

    it("rejects a cookie without the header", async () => {
        const cookie = `sai_csrf=${"a".repeat(43)}`;
        expectError(
            await request(app()).post("/api/v1/thing").set("Cookie", cookie),
            403,
            "CSRF_INVALID"
        );
    });

    it("still hands out a cookie on the rejected response so the client can retry", async () => {
        const res = await request(app()).post("/api/v1/thing");
        expect(res.status).toBe(403);
        expect(readSetCookie(res, "sai_csrf")).toBeDefined();
    });

    it("rejects an unsafe request whose Origin is not in the allowlist, even with a valid token (CORS answers first in the app)", async () => {
        const csrf = await createCsrfAgent(app());
        expectError(
            await csrf
                .post("/api/v1/thing")
                .set("Origin", "https://evil.example"),
            403,
            "CORS_ORIGIN_DENIED"
        );
    });

    it("also checks Origin itself when used without the CORS layer (defence in depth)", () => {
        const token = "t".repeat(43);
        const middleware = csrfProtection({
            enabled: true,
            allowedOrigins: [ORIGIN],
            exempt: [],
        });
        const request = (origin) => ({
            method: "POST",
            cookies: { sai_csrf: token },
            headers: { origin },
            originalUrl: "/x",
            get: () => token,
        });
        const denied = vi.fn();
        middleware(request("https://evil.example"), {}, denied);
        expect(denied.mock.calls[0][0]).toMatchObject({ code: "CSRF_INVALID" });
        const allowed = vi.fn();
        middleware(request(ORIGIN), {}, allowed);
        expect(allowed).toHaveBeenCalledWith();
    });

    it("accepts a listed Origin with a valid token and allows requests with no Origin", async () => {
        const csrf = await createCsrfAgent(app());
        expect(
            (await csrf.post("/api/v1/thing").set("Origin", ORIGIN)).status
        ).toBe(200);
        expect((await csrf.post("/api/v1/thing")).status).toBe(200);
    });

    it.each(["get", "head"])(
        "does not require the header for safe method %s",
        async (method) => {
            expect((await request(app())[method]("/api/v1/thing")).status).toBe(
                200
            );
        }
    );
});

describe("CSRF exempt list (AUTH-18)", () => {
    it("exempts only the signature-verified webhook route", async () => {
        const res = await request(app()).post("/api/v1/media/webhook");
        expect(res.status).toBe(200);
        expect(res.body.webhook).toBe(true);
    });

    it.each([
        "/api/v1/media/webhook-lookalike",
        "/api/v1/media/webhook/extra",
        "/api/v1/MEDIA/webhook",
    ])("does not exempt %s", async (path) => {
        const res = await request(app()).post(path);
        expect([403, 404]).toContain(res.status);
        if (res.status === 403) expect(res.body.code).toBe("CSRF_INVALID");
    });

    it("does not exempt login, register or forgot-password style paths", async () => {
        for (const path of [
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/forgot-password",
        ]) {
            expectError(await request(app()).post(path), 403, "CSRF_INVALID");
        }
    });

    it("matches the exempt route with a query string or trailing slash", async () => {
        expect(
            (await request(app()).post("/api/v1/media/webhook?x=1")).status
        ).toBe(200);
        expect(
            (await request(app()).post("/api/v1/media/webhook/")).status
        ).toBe(200);
    });
});

describe("CSRF configuration", () => {
    it("is skipped entirely when CSRF_ENABLED=false (never allowed in production)", async () => {
        const res = await request(
            app({
                NODE_ENV: "development",
                CSRF_ENABLED: "false",
                EMAIL_TRANSPORT: "log",
            })
        ).post("/api/v1/thing");
        expect(res.status).toBe(200);
        expect(readSetCookie(res, "sai_csrf")).toBeUndefined();
    });

    it("issues a Secure cookie in production", async () => {
        const res = await request(app({ NODE_ENV: "production" })).get(
            "/api/v1/thing"
        );
        expect(setCookieLine(res, "sai_csrf")).toMatch(/Secure/);
    });

    it("works as plain middleware: forwards the error to next and uses injected helpers", () => {
        const middleware = csrfProtection({
            enabled: true,
            allowedOrigins: [],
            exempt: [],
            cookieHelpers: { setCsrfCookie: vi.fn() },
            generateToken: () => "t".repeat(43),
        });
        const next = vi.fn();
        middleware(
            {
                method: "POST",
                cookies: {},
                headers: {},
                originalUrl: "/x",
                get: () => undefined,
            },
            {},
            next
        );
        expect(next.mock.calls[0][0]).toMatchObject({
            code: "CSRF_INVALID",
            statusCode: 403,
        });
    });
});
