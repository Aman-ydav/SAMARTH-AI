import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { noStore, securityHeaders } from "./securityHeaders.js";

const appWith = (isProduction) => {
    const app = express();
    app.use(securityHeaders({ isProduction }));
    app.use(noStore());
    app.get("/x", (_req, res) => res.json({ ok: true }));
    return app;
};

describe("securityHeaders (BE-60)", () => {
    it("sends a deny-everything CSP, no framing, no referrer and nosniff", async () => {
        const res = await request(appWith(false)).get("/x");
        expect(res.headers["content-security-policy"]).toContain(
            "default-src 'none'"
        );
        expect(res.headers["content-security-policy"]).toContain(
            "frame-ancestors 'none'"
        );
        expect(res.headers["x-frame-options"]).toBe("DENY");
        expect(res.headers["referrer-policy"]).toBe("no-referrer");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
        expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("sends HSTS only in production", async () => {
        expect(
            (await request(appWith(false)).get("/x")).headers[
                "strict-transport-security"
            ]
        ).toBeUndefined();
        const header = (await request(appWith(true)).get("/x")).headers[
            "strict-transport-security"
        ];
        expect(header).toContain("max-age=15552000");
        expect(header).toContain("includeSubDomains");
    });

    it("noStore marks responses as uncacheable", async () => {
        expect(
            (await request(appWith(false)).get("/x")).headers["cache-control"]
        ).toBe("no-store");
    });
});
