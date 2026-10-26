import { describe, expect, it } from "vitest";
import {
    hmacIdentifier,
    hmacRefreshToken,
    hmacSha256Hex,
    randomToken,
    sha256Hex,
    timingSafeEqual,
} from "./hash.js";

describe("randomToken", () => {
    it("is URL-safe, unique and 32 bytes by default", () => {
        const a = randomToken();
        const b = randomToken();
        expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(a).not.toBe(b);
    });

    it("honours a custom byte length", () => {
        expect(Buffer.from(randomToken(16), "base64url")).toHaveLength(16);
    });
});

describe("digests", () => {
    it("sha256Hex matches the known vector", () => {
        expect(sha256Hex("abc")).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    });

    it("hmacSha256Hex matches RFC 4231 test case 2", () => {
        expect(hmacSha256Hex("what do ya want for nothing?", "Jefe")).toBe(
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
    });

    it("identifier and refresh hashes are keyed, deterministic and differ from each other (R9)", () => {
        const identifier = hmacIdentifier("user@example.test");
        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(hmacIdentifier("user@example.test")).toBe(identifier);
        expect(hmacRefreshToken("user@example.test")).not.toBe(identifier);
        expect(
            hmacIdentifier(
                "user@example.test",
                "another-secret-another-secret-123"
            )
        ).not.toBe(identifier);
    });
});

describe("timingSafeEqual", () => {
    it("is true only for equal strings", () => {
        expect(timingSafeEqual("same", "same")).toBe(true);
        expect(timingSafeEqual("same", "SAME")).toBe(false);
    });

    it("handles different lengths without throwing", () => {
        expect(timingSafeEqual("short", "a-much-longer-value")).toBe(false);
        expect(timingSafeEqual("", "x")).toBe(false);
    });

    it("rejects non-strings", () => {
        expect(timingSafeEqual(undefined, "x")).toBe(false);
        expect(timingSafeEqual("x", null)).toBe(false);
        expect(timingSafeEqual(1, 1)).toBe(false);
    });
});
