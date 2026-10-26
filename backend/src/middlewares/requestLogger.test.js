import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "#utils/logger.js";
import { requestId } from "./requestId.js";
import { requestLogger } from "./requestLogger.js";

function capturedApp(handler = (_req, res) => res.json({ ok: true })) {
    const lines = [];
    const destination = new Writable({
        write(chunk, _encoding, done) {
            lines.push(JSON.parse(chunk.toString()));
            done();
        },
    });
    const app = express();
    app.use(requestId());
    app.use(requestLogger(createLogger({ level: "trace", destination })));
    app.all("/things", handler);
    app.get("/health", (_req, res) => res.json({ ok: true }));
    return { app, lines };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("requestLogger (BE-80, BE-81)", () => {
    it("writes one structured line per request with method, path, status, duration and request id", async () => {
        const { app, lines } = capturedApp();
        const res = await request(app)
            .get("/things?email=asha@example.test&x=1")
            .set("X-Request-Id", "trace-id-12345");
        await settle();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({
            level: "info",
            msg: "request completed",
            requestId: "trace-id-12345",
            req: { method: "GET", path: "/things" },
            res: { statusCode: 200 },
        });
        expect(typeof lines[0].responseTime).toBe("number");
        expect(res.headers["x-request-id"]).toBe("trace-id-12345");
    });

    it("never logs the query string, headers, cookies or bodies", async () => {
        const { app, lines } = capturedApp();
        await request(app)
            .post("/things?email=asha@example.test")
            .set("Cookie", "sai_access=top-secret")
            .set("Authorization", "Bearer abc")
            .send({ password: "hunter2hunter2" });
        await settle();
        const text = JSON.stringify(lines);
        for (const secret of [
            "asha@example.test",
            "top-secret",
            "Bearer abc",
            "hunter2hunter2",
        ])
            expect(text).not.toContain(secret);
    });

    it("logs 4xx as warn and 5xx as error", async () => {
        const warn = capturedApp((_req, res) => res.status(404).json({}));
        await request(warn.app).get("/things");
        await settle();
        expect(warn.lines[0].level).toBe("warn");
        const error = capturedApp((_req, res) => res.status(503).json({}));
        await request(error.app).get("/things");
        await settle();
        expect(error.lines[0].level).toBe("error");
    });

    it("skips health probes", async () => {
        const { app, lines } = capturedApp();
        await request(app).get("/health");
        await settle();
        expect(lines).toEqual([]);
    });

    it("includes the user id when a later middleware sets req.user", async () => {
        const { app, lines } = capturedApp((req, res) => {
            req.user = { id: "u-1" };
            res.json({});
        });
        await request(app).get("/things");
        await settle();
        expect(lines[0].userId).toBe("u-1");
    });
});
