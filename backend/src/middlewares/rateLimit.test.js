import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectError } from "#tests/helpers/envelopes.js";
import { createLogger } from "#utils/logger.js";
import { createErrorHandler } from "./errorHandler.js";
import {
    aiLimiter,
    authSensitiveLimiter,
    createLimiter,
    globalLimiter,
    RATE_LIMIT_TIERS,
} from "./rateLimit.js";
import { requestId } from "./requestId.js";

const silent = createLogger({ level: "silent", isDevelopment: false });

function appWith(...limiters) {
    const app = express();
    app.use(requestId());
    for (const limiter of limiters) app.use(limiter);
    app.all("/x", (_req, res) => res.json({ ok: true }));
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.use(createErrorHandler({ isDevelopment: false, log: silent }));
    return app;
}
const hit = (app, n, path = "/x") =>
    Promise.all(Array.from({ length: n }, () => request(app).get(path))).then(
        (all) => all.map((res) => res.status)
    );
const sequential = async (app, n, configure = (r) => r) => {
    const statuses = [];
    for (let i = 0; i < n; i += 1)
        statuses.push((await configure(request(app).get("/x"))).status);
    return statuses;
};

afterEach(() => {
    vi.useRealTimers();
});

describe("createLimiter", () => {
    it("allows up to the limit then answers 429 RATE_LIMITED with Retry-After and retryAfterSec", async () => {
        const app = appWith(
            createLimiter({ name: "t", windowMs: 60_000, limit: 2 })
        );
        expect(await sequential(app, 2)).toEqual([200, 200]);
        const res = await request(app).get("/x");
        const body = expectError(res, 429, "RATE_LIMITED");
        expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
        expect(Number(res.headers["retry-after"])).toBeLessThanOrEqual(60);
        expect(body.retryAfterSec).toBe(Number(res.headers["retry-after"]));
    });

    it("sends standard RateLimit headers and no legacy X-RateLimit headers", async () => {
        const res = await request(
            appWith(createLimiter({ name: "t", windowMs: 60_000, limit: 5 }))
        ).get("/x");
        expect(res.headers["ratelimit-limit"]).toBe("5");
        expect(res.headers["ratelimit-remaining"]).toBe("4");
        expect(res.headers["ratelimit-reset"]).toBeDefined();
        expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
    });

    it("counts again after the window passes", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const app = appWith(
            createLimiter({ name: "t", windowMs: 1000, limit: 1 })
        );
        expect(await sequential(app, 2)).toEqual([200, 429]);
        vi.setSystemTime(Date.now() + 1500);
        expect(await sequential(app, 1)).toEqual([200]);
    });

    it("multiplies IP-scoped limits by RATE_LIMIT_IP_MULTIPLIER (R10)", async () => {
        const app = appWith(
            createLimiter({
                name: "t",
                windowMs: 60_000,
                limit: 2,
                multiplier: 3,
            })
        );
        expect(await sequential(app, 7)).toEqual([
            200, 200, 200, 200, 200, 200, 429,
        ]);
    });

    it("never multiplies per-account limits (ipScoped: false)", async () => {
        const app = appWith(
            createLimiter({
                name: "acct",
                windowMs: 60_000,
                limit: 2,
                multiplier: 50,
                ipScoped: false,
                key: (req) => req.get("x-account"),
            })
        );
        expect(
            await sequential(app, 3, (r) => r.set("x-account", "a"))
        ).toEqual([200, 200, 429]);
    });

    it("keeps separate counters per custom key", async () => {
        const app = appWith(
            createLimiter({
                name: "acct",
                windowMs: 60_000,
                limit: 1,
                ipScoped: false,
                key: (req) => req.get("x-account"),
            })
        );
        expect(
            await sequential(app, 2, (r) => r.set("x-account", "a"))
        ).toEqual([200, 429]);
        expect(
            await sequential(app, 1, (r) => r.set("x-account", "b"))
        ).toEqual([200]);
    });

    it("lets two limiters with different names count independently", async () => {
        const app = appWith(
            createLimiter({ name: "one", windowMs: 60_000, limit: 1 }),
            createLimiter({ name: "two", windowMs: 60_000, limit: 100 })
        );
        expect(await sequential(app, 2)).toEqual([200, 429]);
    });

    it("keeps counting correctly under concurrency", async () => {
        const app = appWith(
            createLimiter({ name: "t", windowMs: 60_000, limit: 5 })
        );
        const statuses = await hit(app, 12);
        expect(statuses.filter((s) => s === 200)).toHaveLength(5);
        expect(statuses.filter((s) => s === 429)).toHaveLength(7);
    });

    it("honours skip", async () => {
        const app = appWith(
            createLimiter({
                name: "t",
                windowMs: 60_000,
                limit: 1,
                skip: (req) => req.path === "/health",
            })
        );
        expect(await hit(app, 3, "/health")).toEqual([200, 200, 200]);
    });

    it("uses the configured multiplier by default (1 in tests)", async () => {
        const res = await request(
            appWith(createLimiter({ name: "t", windowMs: 60_000, limit: 4 }))
        ).get("/x");
        expect(res.headers["ratelimit-limit"]).toBe("4");
    });
});

describe("tiers", () => {
    it("global limiter reads window and max from config and never limits health or preflights", async () => {
        const config = {
            rateLimit: { windowMs: 60_000, max: 1, ipMultiplier: 1 },
        };
        const app = appWith(globalLimiter(config));
        expect(await hit(app, 3, "/health")).toEqual([200, 200, 200]);
        const options = await request(app).options("/x");
        expect(options.status).not.toBe(429);
        expect(await sequential(app, 2)).toEqual([200, 429]);
    });

    it("global limiter applies the multiplier from config", async () => {
        const app = appWith(
            globalLimiter({
                rateLimit: { windowMs: 60_000, max: 1, ipMultiplier: 4 },
            })
        );
        expect(await sequential(app, 5)).toEqual([200, 200, 200, 200, 429]);
    });

    it("auth-sensitive tier defaults to 10 per 15 minutes and accepts overrides", async () => {
        expect(RATE_LIMIT_TIERS.authSensitive).toEqual({
            windowMs: 900_000,
            limit: 10,
        });
        const res = await request(appWith(authSensitiveLimiter())).get("/x");
        expect(res.headers["ratelimit-limit"]).toBe("10");
        const tight = await request(
            appWith(authSensitiveLimiter({ limit: 3, name: "login" }))
        ).get("/x");
        expect(tight.headers["ratelimit-limit"]).toBe("3");
    });

    it("AI tier defaults to 20 per minute", async () => {
        expect(RATE_LIMIT_TIERS.ai).toEqual({ windowMs: 60_000, limit: 20 });
        expect(
            (await request(appWith(aiLimiter())).get("/x")).headers[
                "ratelimit-limit"
            ]
        ).toBe("20");
    });
});
