import { afterEach, describe, expect, it } from "vitest";
import {
    DEFAULT_LANGUAGE,
    detectLanguage,
    formatCountdown,
    formatDate,
    formatDateTime,
    formatNumber,
    formatRelativeTime,
    isSupportedLanguage,
    resolveLanguage,
    resolveLocale,
} from "@/lib/format";

afterEach(() => localStorage.clear());

describe("languages", () => {
    it("resolves locale tags to supported languages", () => {
        expect(resolveLanguage("hi-IN")).toBe("hi");
        expect(resolveLanguage("EN_us")).toBe("en");
        expect(resolveLanguage("fr")).toBe(DEFAULT_LANGUAGE);
        expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
        expect(isSupportedLanguage("hi")).toBe(true);
        expect(isSupportedLanguage("fr")).toBe(false);
    });

    it("prefers the persisted choice over the browser language", () => {
        localStorage.setItem("sai-lang", "hi");
        expect(detectLanguage()).toBe("hi");
    });

    it("ignores an invalid persisted value", () => {
        localStorage.setItem("sai-lang", "klingon");
        expect(detectLanguage()).toBe("en");
    });

    it("uses Latin digits for Hindi", () => {
        expect(resolveLocale("hi")).toContain("nu-latn");
        expect(formatNumber(1234, "hi")).toBe("1,234");
    });
});

describe("date and number formatting", () => {
    it("formats dates in Asia/Kolkata", () => {
        expect(formatDate("2026-10-26T20:00:00Z", "en")).toContain("27");
        expect(formatDateTime("2026-10-26T18:30:00Z", "en")).toMatch(/12:00/);
    });

    it("returns an empty string for invalid dates and numbers", () => {
        expect(formatDate("not a date")).toBe("");
        expect(formatDate(null)).toBe("");
        expect(formatNumber(Number.NaN)).toBe("");
        expect(formatNumber("5")).toBe("");
    });

    it("formats relative time", () => {
        const now = Date.parse("2026-10-26T10:00:00Z");
        expect(formatRelativeTime("2026-10-26T09:55:00Z", "en", now)).toBe(
            "5 minutes ago"
        );
        expect(formatRelativeTime("2026-10-26T09:59:30Z", "en", now)).toBe(
            "30 seconds ago"
        );
        expect(formatRelativeTime("bad", "en", now)).toBe("");
    });

    it("formats countdowns", () => {
        expect(formatCountdown(0)).toBe("0:00");
        expect(formatCountdown(59.2)).toBe("1:00");
        expect(formatCountdown(899)).toBe("14:59");
        expect(formatCountdown(3723)).toBe("1:02:03");
        expect(formatCountdown(-5)).toBe("0:00");
        expect(formatCountdown(undefined)).toBe("0:00");
    });
});
