import { describe, expect, it } from "vitest";
import {
    addMs,
    earliestDate,
    isExpired,
    nowIso,
    parseDuration,
    secondsUntil,
} from "./dates.js";

describe("parseDuration", () => {
    it.each([
        ["500ms", 500],
        ["30s", 30_000],
        ["15m", 900_000],
        ["2h", 7_200_000],
        ["7d", 604_800_000],
    ])("parses %s", (input, expected) => {
        expect(parseDuration(input)).toBe(expected);
    });

    it.each(["", "15", "m", "-5m", "1.5h", "5w", "0d", "abc", "10 m x"])(
        "rejects %j",
        (input) => {
            expect(() => parseDuration(input)).toThrow(RangeError);
        }
    );
});

describe("date helpers", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");

    it("nowIso returns a UTC ISO string", () => {
        expect(nowIso(base)).toBe("2026-01-01T00:00:00.000Z");
    });

    it("addMs does not mutate its input", () => {
        const result = addMs(base, 1000);
        expect(result.toISOString()).toBe("2026-01-01T00:00:01.000Z");
        expect(base.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("isExpired treats missing, invalid and past dates as expired", () => {
        expect(isExpired(undefined, base)).toBe(true);
        expect(isExpired("not-a-date", base)).toBe(true);
        expect(isExpired(base, base)).toBe(true);
        expect(isExpired(addMs(base, 1), base)).toBe(false);
    });

    it("earliestDate picks the smallest", () => {
        expect(
            earliestDate(addMs(base, 5000), base, addMs(base, 1)).getTime()
        ).toBe(base.getTime());
    });

    it("secondsUntil rounds up and never goes negative", () => {
        expect(secondsUntil(addMs(base, 1500), base)).toBe(2);
        expect(secondsUntil(addMs(base, -5000), base)).toBe(0);
    });
});
