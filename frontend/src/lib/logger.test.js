import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
    it("passes only allow-listed non-PII context", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        logger.error("Something failed", {
            code: "X",
            status: 500,
            email: "a@example.test",
            token: "secret",
            requestId: "r1",
            nested: { a: 1 },
        });
        expect(spy).toHaveBeenCalledWith("[samarth] Something failed", {
            code: "X",
            status: 500,
            requestId: "r1",
        });
    });

    it("tolerates missing or invalid context", () => {
        const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
        logger.warn("no context");
        logger.warn("bad context", "text");
        expect(spy).toHaveBeenNthCalledWith(1, "[samarth] no context", {});
        expect(spy).toHaveBeenNthCalledWith(2, "[samarth] bad context", {});
    });

    it("emits debug and info only in development mode", () => {
        const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        logger.debug("d");
        logger.info("i");
        const expected = import.meta.env.DEV ? 1 : 0;
        expect(debug).toHaveBeenCalledTimes(expected);
        expect(info).toHaveBeenCalledTimes(expected);
    });
});
