import { describe, expect, it, vi } from "vitest";
import { notFound } from "./notFound.js";

describe("notFound", () => {
    it("forwards a 404 NOT_FOUND ApiError and does not echo the path", () => {
        const next = vi.fn();
        notFound()({ originalUrl: "/secret/path?token=abc" }, {}, next);
        const error = next.mock.calls[0][0];
        expect(error).toMatchObject({
            statusCode: 404,
            code: "NOT_FOUND",
            message: "Route not found",
            isOperational: true,
        });
        expect(JSON.stringify(error.errors)).not.toContain("secret");
    });
});
