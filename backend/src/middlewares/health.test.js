import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { startTestDb, stopTestDb } from "#tests/helpers/testDb.js";
import { createLogger } from "#utils/logger.js";
import { disconnectDb } from "#db/connect.js";
import { createErrorHandler } from "./errorHandler.js";
import { healthRouter } from "./health.js";
import { requestId } from "./requestId.js";

const silent = createLogger({ level: "silent", isDevelopment: false });
const appWith = (options) => {
    const app = express();
    app.use(requestId());
    app.use(healthRouter(options));
    app.use(createErrorHandler({ isDevelopment: false, log: silent }));
    return app;
};

describe("GET /health (BE-05)", () => {
    it("reports the process alive without touching dependencies", async () => {
        let calls = 0;
        const res = await request(
            appWith({
                readinessCheck: async () => {
                    calls += 1;
                    return false;
                },
            })
        ).get("/health");
        const body = expectSuccess(res, 200);
        expect(body.data).toEqual({ status: "ok" });
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(calls).toBe(0);
    });

    it("leaks no versions, config or environment", async () => {
        const res = await request(
            appWith({ readinessCheck: async () => true })
        ).get("/health");
        expect(JSON.stringify(res.body)).not.toMatch(
            /version|node|express|mongo|env|uptime/i
        );
    });
});

describe("GET /ready (BE-05, EDGE-54)", () => {
    it("returns 200 when the readiness probe passes", async () => {
        const body = expectSuccess(
            await request(appWith({ readinessCheck: async () => true })).get(
                "/ready"
            ),
            200
        );
        expect(body.data.status).toBe("ready");
    });

    it("returns 503 INTEGRATION_ERROR with Retry-After when the probe fails", async () => {
        const res = await request(
            appWith({ readinessCheck: async () => false })
        ).get("/ready");
        expectError(res, 503, "INTEGRATION_ERROR");
        expect(res.headers["retry-after"]).toBe("5");
    });

    it("returns 503 when the probe throws", async () => {
        const res = await request(
            appWith({
                readinessCheck: async () => {
                    throw new Error("mongo down");
                },
            })
        ).get("/ready");
        expectError(res, 503, "INTEGRATION_ERROR");
        expect(JSON.stringify(res.body)).not.toContain("mongo down");
    });
});

describe("GET /ready against the database", () => {
    beforeAll(async () => {
        await disconnectDb();
    });
    afterAll(stopTestDb);

    it("is 503 while disconnected and 200 once connected", async () => {
        const app = appWith();
        expectError(await request(app).get("/ready"), 503, "INTEGRATION_ERROR");
        await startTestDb();
        const body = expectSuccess(await request(app).get("/ready"), 200);
        expect(body.data).toEqual({ status: "ready", db: "connected" });
        expect(mongoose.connection.readyState).toBe(1);
    });
});
