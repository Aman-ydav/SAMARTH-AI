import { describe, expect, it, vi } from "vitest";
import { requestId } from "./requestId.js";

const run = (headers = {}) => {
    const req = { headers };
    const res = { locals: {}, setHeader: vi.fn() };
    const next = vi.fn();
    requestId()(req, res, next);
    return { req, res, next };
};

describe("requestId (BE-82)", () => {
    it("generates a UUID when none is sent and exposes it everywhere", () => {
        const { req, res, next } = run();
        expect(req.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
        expect(res.locals.requestId).toBe(req.id);
        expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.id);
        expect(next).toHaveBeenCalledOnce();
    });

    it("accepts a well-formed incoming id", () => {
        expect(run({ "x-request-id": "client-req_123.abc" }).req.id).toBe(
            "client-req_123.abc"
        );
    });

    it.each([
        ["too short", "abc"],
        ["too long", "a".repeat(65)],
        ["spaces", "has space in it"],
        ["a header-injection attempt", "abcdefgh\r\nSet-Cookie: x=1"],
        ["markup", "<script>alert(1)</script>"],
        ["a duplicate header joined with a comma", "abcdefgh1, abcdefgh2"],
        ["empty", ""],
    ])("replaces an id that is %s", (_label, value) => {
        const { req } = run({ "x-request-id": value });
        expect(req.id).not.toBe(value);
        expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("generates distinct ids for distinct requests", () => {
        expect(run().req.id).not.toBe(run().req.id);
    });
});
