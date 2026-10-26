import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { BCRYPT_COST } from "#constants/tokenTypes.js";
import {
    assertNotReused,
    assertPasswordPolicy,
    checkPasswordPolicy,
    dummyCompare,
    hashPassword,
    matchesAny,
    nextPasswordHistory,
    verifyPassword,
} from "./password.service.js";

const STRONG = "correct horse battery staple";

describe("hashing", () => {
    it("hashes with bcrypt cost 12 and verifies the right and the wrong password", async () => {
        const hash = await hashPassword(STRONG);
        expect(BCRYPT_COST).toBe(12);
        expect(hash).toMatch(/^\$2[aby]\$12\$/);
        expect(hash).not.toContain(STRONG);
        await expect(verifyPassword(STRONG, hash)).resolves.toBe(true);
        await expect(
            verifyPassword("another long passphrase", hash)
        ).resolves.toBe(false);
    });

    it("never matches a password over 72 bytes, even when its first 72 bytes are the real password", async () => {
        const long = "x".repeat(72);
        const hash = await hashPassword(long);
        await expect(verifyPassword(long, hash)).resolves.toBe(true);
        await expect(verifyPassword(long + "tail", hash)).resolves.toBe(false);
    });

    it("compares against the cost-12 dummy hash when there is no stored hash (AUTH-23)", async () => {
        const compare = vi.spyOn(bcrypt, "compare");
        await expect(verifyPassword(STRONG, undefined)).resolves.toBe(false);
        await expect(verifyPassword(STRONG, "")).resolves.toBe(false);
        await expect(dummyCompare(undefined)).resolves.toBe(false);
        expect(compare).toHaveBeenCalledTimes(3);
        for (const [, hash] of compare.mock.calls)
            expect(hash).toMatch(/^\$2b\$12\$/);
    });
});

describe("checkPasswordPolicy", () => {
    it("accepts a long passphrase with spaces and Unicode", () => {
        expect(checkPasswordPolicy(STRONG)).toEqual([]);
        expect(checkPasswordPolicy("पासवर्ड सुरक्षित है")).toEqual([]);
    });

    it("enforces the 10-character minimum counting characters, not bytes", () => {
        expect(checkPasswordPolicy("abcdefghi")).toContain("too_short");
        expect(checkPasswordPolicy("abcdefghij")).not.toContain("too_short");
        expect(checkPasswordPolicy("🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂")).not.toContain(
            "too_short"
        );
    });

    it("enforces the 72-byte maximum on UTF-8 bytes (R4), not on characters", () => {
        expect(checkPasswordPolicy("x".repeat(72))).not.toContain("too_long");
        expect(checkPasswordPolicy("x".repeat(73))).toContain("too_long");
        // 24 emoji = 96 bytes but only 24 characters
        expect(checkPasswordPolicy("🙂".repeat(24))).toContain("too_long");
        // 18 emoji = 72 bytes exactly
        expect(checkPasswordPolicy("🙂".repeat(18))).not.toContain("too_long");
        // 36 Devanagari letters = 108 bytes
        expect(checkPasswordPolicy("क".repeat(36))).toContain("too_long");
    });

    it.each([
        ["password123", "common"],
        ["Password-123!", "common"],
        ["QWERTYUIOP", "common"],
        ["1234567890", "common"],
        ["aaaaaaaaaaaa", "repeated"],
    ])("rejects %s", (password, code) => {
        expect(checkPasswordPolicy(password)).toContain(code);
    });

    it("rejects passwords containing the email local part or a name word", () => {
        const context = {
            email: "ananya.rao@example.test",
            name: "Ananya Rao",
        };
        expect(checkPasswordPolicy("my-ananya.rao-secret", context)).toContain(
            "contains_email"
        );
        expect(checkPasswordPolicy("Ananya is great 2026", context)).toContain(
            "contains_name"
        );
        expect(
            checkPasswordPolicy("completely unrelated phrase", context)
        ).toEqual([]);
    });

    it("ignores very short email local parts and short name words", () => {
        const context = { email: "ab@example.test", name: "Al Bo" };
        expect(
            checkPasswordPolicy("ab long unrelated phrase", context)
        ).toEqual([]);
    });
});

describe("assertPasswordPolicy", () => {
    it("throws PASSWORD_POLICY with one entry per violated rule and never echoes the password", () => {
        const attempt = () => assertPasswordPolicy("Zq9-x", {}, "newPassword");
        expect(attempt).toThrowError(
            expect.objectContaining({
                statusCode: 400,
                code: "PASSWORD_POLICY",
            })
        );
        try {
            attempt();
        } catch (error) {
            expect(error.errors).toEqual([
                expect.objectContaining({
                    field: "newPassword",
                    code: "too_short",
                }),
            ]);
            expect(JSON.stringify(error.errors)).not.toContain("Zq9");
        }
    });

    it("passes silently for a good password", () => {
        expect(() => assertPasswordPolicy(STRONG)).not.toThrow();
    });
});

describe("reuse checks", () => {
    it("detects the current hash and any history hash", async () => {
        const current = await hashPassword("current passphrase one");
        const older = await hashPassword("older passphrase two");
        expect(
            await matchesAny("current passphrase one", [current, older])
        ).toBe(true);
        expect(await matchesAny("older passphrase two", [current, older])).toBe(
            true
        );
        expect(
            await matchesAny("brand new passphrase", [
                current,
                older,
                undefined,
            ])
        ).toBe(false);
        await expect(
            assertNotReused("older passphrase two", {
                passwordHash: current,
                passwordHistory: [older],
            })
        ).rejects.toMatchObject({ statusCode: 400, code: "PASSWORD_REUSED" });
        await expect(
            assertNotReused("brand new passphrase", {
                passwordHash: current,
                passwordHistory: [older],
            })
        ).resolves.toBeUndefined();
    });

    it("keeps at most three previous hashes, newest first", () => {
        expect(nextPasswordHistory("h4", ["h3", "h2", "h1"])).toEqual([
            "h4",
            "h3",
            "h2",
        ]);
        expect(nextPasswordHistory(undefined, ["h1"])).toEqual(["h1"]);
        expect(nextPasswordHistory("h1")).toEqual(["h1"]);
    });
});
