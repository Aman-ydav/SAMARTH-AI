import { describe, expect, it } from "vitest";
import {
    hasControlCharacters,
    maskEmail,
    normalizeEmail,
    truncate,
    utf8ByteLength,
} from "./strings.js";

describe("normalizeEmail", () => {
    it("trims, lowercases and applies NFKC", () => {
        expect(normalizeEmail("  User@Example.TEST ")).toBe(
            "user@example.test"
        );
        expect(normalizeEmail("ＵＳＥＲ@example.test")).toBe(
            "user@example.test"
        );
    });

    it("never throws on missing input", () => {
        expect(normalizeEmail(undefined)).toBe("");
        expect(normalizeEmail(null)).toBe("");
    });
});

describe("utf8ByteLength", () => {
    it("counts bytes, not characters (R4)", () => {
        expect(utf8ByteLength("abc")).toBe(3);
        expect(utf8ByteLength("é")).toBe(2);
        expect(utf8ByteLength("नमस्ते")).toBe(18);
        expect(utf8ByteLength(undefined)).toBe(0);
    });
});

describe("truncate", () => {
    it("cuts long text and leaves short text alone", () => {
        expect(truncate("abcdef", 3)).toBe("abc");
        expect(truncate("ab", 3)).toBe("ab");
        expect(truncate(undefined, 3)).toBe("");
    });
});

describe("hasControlCharacters", () => {
    it("detects control characters", () => {
        expect(hasControlCharacters("line\nbreak")).toBe(true);
        expect(hasControlCharacters("nul\u0000")).toBe(true);
        expect(hasControlCharacters("plain नमस्ते 😀")).toBe(false);
    });
});

describe("maskEmail", () => {
    it("keeps the first character and the domain", () => {
        expect(maskEmail("ananya@example.test")).toBe("a***@example.test");
        expect(maskEmail("Z@x.test")).toBe("Z***@x.test");
        expect(maskEmail("")).toBe("***@");
    });
});
