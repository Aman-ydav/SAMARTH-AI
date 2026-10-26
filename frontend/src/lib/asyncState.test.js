import { describe, expect, it } from "vitest";
import {
    STATUS,
    TTL,
    asyncInitial,
    isFresh,
    opInitial,
} from "@/lib/asyncState";

describe("asyncState", () => {
    it("exposes the shared initial slice fields", () => {
        expect(asyncInitial).toEqual({
            status: "idle",
            error: null,
            lastFetchedAt: null,
        });
        expect(opInitial).toEqual({ status: "idle", error: null });
        expect(STATUS.LOADING).toBe("loading");
    });

    it("applies the documented TTLs", () => {
        expect(TTL.me).toBe(300000);
        expect(TTL.notifications).toBe(0);
    });

    it("treats a timestamp inside its TTL as fresh", () => {
        expect(isFresh(1000, 500, 1400)).toBe(true);
        expect(isFresh(1000, 500, 1500)).toBe(false);
    });

    it("never treats a missing timestamp or a zero TTL as fresh", () => {
        expect(isFresh(null, 500, 1)).toBe(false);
        expect(isFresh(1000, 0, 1000)).toBe(false);
    });
});
