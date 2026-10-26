import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { LoginAttempt } from "./loginAttempt.model.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const makeAttempt = (overrides = {}) => ({
    keyHash: "d".repeat(64),
    kind: "email",
    firstAttemptAt: new Date(),
    lastAttemptAt: new Date(),
    ...overrides,
});

describe("LoginAttempt model", () => {
    it("declares a unique key hash and a 24 hour TTL on lastAttemptAt", async () => {
        const indexes = Object.fromEntries(
            (await LoginAttempt.collection.indexes()).map((i) => [i.name, i])
        );
        expect(indexes.loginAttempts_keyHash_uq.unique).toBe(true);
        expect(indexes.loginAttempts_lastAttemptAt_ttl.expireAfterSeconds).toBe(
            86_400
        );
    });

    it("defaults count to 0 and lockUntil to null, and has no org or raw identifier fields", async () => {
        const attempt = await LoginAttempt.create(makeAttempt());
        expect(attempt).toMatchObject({ count: 0, lockUntil: null });
        const fields = Object.keys(LoginAttempt.schema.paths);
        for (const forbidden of ["email", "ip", "orgId"]) {
            expect(fields).not.toContain(forbidden);
        }
    });

    it("accepts only the kinds email and ip and a 64 character key", async () => {
        await expect(
            LoginAttempt.create(makeAttempt({ kind: "phone" }))
        ).rejects.toThrow();
        await expect(
            LoginAttempt.create(makeAttempt({ keyHash: "short" }))
        ).rejects.toThrow();
        await expect(
            LoginAttempt.create(
                makeAttempt({ kind: "ip", keyHash: "e".repeat(64) })
            )
        ).resolves.toBeTruthy();
    });

    it("refuses a duplicate key, a negative or fractional count and missing dates", async () => {
        await LoginAttempt.create(makeAttempt());
        await expect(LoginAttempt.create(makeAttempt())).rejects.toMatchObject({
            code: 11000,
        });
        const other = { keyHash: "f".repeat(64) };
        await expect(
            LoginAttempt.create(makeAttempt({ ...other, count: -1 }))
        ).rejects.toThrow();
        await expect(
            LoginAttempt.create(makeAttempt({ ...other, count: 1.5 }))
        ).rejects.toThrow();
        await expect(
            LoginAttempt.create(
                makeAttempt({ ...other, firstAttemptAt: undefined })
            )
        ).rejects.toThrow();
    });
});
