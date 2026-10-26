import { describe, expect, it, vi } from "vitest";
import { env } from "#config/env.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { hmacIdentifier } from "./hash.js";
import { attachDeps, buildRequestContext } from "./requestContext.js";

const fakeReq = (overrides = {}) => ({
    id: "req-1",
    ip: "198.51.100.4",
    headers: { "user-agent": "UnitTest/1.0" },
    ...overrides,
});

describe("attachDeps", () => {
    it("puts the dependencies on the request and continues", () => {
        const deps = { config: env };
        const req = fakeReq();
        const next = vi.fn();
        attachDeps(deps)(req, {}, next);
        expect(req.deps).toBe(deps);
        expect(next).toHaveBeenCalledWith();
    });
});

describe("buildRequestContext", () => {
    it("derives hashed ip, truncated user agent and request id, and never exposes the raw ip", () => {
        const ctx = buildRequestContext(fakeReq());
        expect(ctx.requestId).toBe("req-1");
        expect(ctx.ipHash).toBe(hmacIdentifier("198.51.100.4"));
        expect(ctx.userAgent).toBe("UnitTest/1.0");
        expect(ctx.userAgentHash).toBe(hmacIdentifier("UnitTest/1.0"));
        expect(JSON.stringify(ctx)).not.toContain("198.51.100.4");
        expect(ctx.config).toBe(env);
    });

    it("cuts a long user agent to 200 characters", () => {
        const ctx = buildRequestContext(
            fakeReq({ headers: { "user-agent": "a".repeat(500) } })
        );
        expect(ctx.userAgent).toHaveLength(200);
    });

    it("uses the router config for the hashing secret and spreads the router deps", () => {
        const config = makeTestEnv({ IDENTIFIER_HASH_SECRET: "k".repeat(48) });
        const marker = Symbol("dep");
        const ctx = buildRequestContext(fakeReq({ deps: { config, marker } }));
        expect(ctx.config).toBe(config);
        expect(ctx.marker).toBe(marker);
        expect(ctx.ipHash).toBe(
            hmacIdentifier("198.51.100.4", config.auth.identifierHashSecret)
        );
    });

    it("mail() queues through the email service and tags the request id", () => {
        const emailService = { enqueueEmail: vi.fn() };
        const ctx = buildRequestContext(fakeReq({ deps: { emailService } }));
        const message = {
            to: "a@example.test",
            templateKey: "welcome",
            data: {},
        };
        ctx.mail(message);
        expect(emailService.enqueueEmail).toHaveBeenCalledWith(message, {
            requestId: "req-1",
        });
    });
});
