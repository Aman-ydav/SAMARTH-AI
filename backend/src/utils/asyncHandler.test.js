import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler.js";

describe("asyncHandler", () => {
    it("passes req, res and next to the handler and does not call next on success", async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const next = vi.fn();
        const req = {};
        const res = {};
        asyncHandler(handler)(req, res, next);
        await Promise.resolve();
        expect(handler).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards a rejection to next", async () => {
        const failure = new Error("boom");
        const next = vi.fn();
        asyncHandler(async () => {
            throw failure;
        })({}, {}, next);
        await new Promise((resolve) => setImmediate(resolve));
        expect(next).toHaveBeenCalledWith(failure);
    });

    it("forwards a synchronous throw to next", () => {
        const failure = new Error("sync");
        const next = vi.fn();
        asyncHandler(() => {
            throw failure;
        })({}, {}, next);
        expect(next).toHaveBeenCalledWith(failure);
    });

    it("never sends a response itself", async () => {
        const res = {
            status: vi.fn(),
            json: vi.fn(),
            send: vi.fn(),
            end: vi.fn(),
        };
        asyncHandler(async () => "value")({}, res, vi.fn());
        await Promise.resolve();
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
    });
});
