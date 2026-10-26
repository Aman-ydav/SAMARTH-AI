import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { LOCKOUT } from "./auth.constants.js";
import { LoginAttempt } from "./loginAttempt.model.js";
import {
    clearEmailAttempts,
    emailAttemptKey,
    getActiveLock,
    lockDurationMs,
    recordFailure,
} from "./loginAttempt.service.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const config = makeTestEnv();
const keys = (email = "someone@example.test", ip = "i".repeat(64)) => ({
    emailKey: emailAttemptKey(email, config),
    ipKey: ip,
});

async function fail(times, key = keys(), now = new Date()) {
    let last;
    for (let i = 0; i < times; i += 1) last = await recordFailure(key, now);
    return last;
}

describe("emailAttemptKey", () => {
    it("is an HMAC of the normalised email: stable, case and NFKC insensitive, never the raw address", () => {
        const key = emailAttemptKey("User@Example.test", config);
        expect(key).toMatch(/^[a-f0-9]{64}$/);
        expect(emailAttemptKey("  user@example.TEST ", config)).toBe(key);
        expect(emailAttemptKey("ｕser@example.test", config)).toBe(key);
        expect(key).not.toContain("user");
        expect(emailAttemptKey("other@example.test", config)).not.toBe(key);
    });

    it("depends on IDENTIFIER_HASH_SECRET (R9)", () => {
        const other = makeTestEnv({ IDENTIFIER_HASH_SECRET: "q".repeat(48) });
        expect(emailAttemptKey("a@example.test", other)).not.toBe(
            emailAttemptKey("a@example.test", config)
        );
    });
});

describe("lockDurationMs (AUTH-36)", () => {
    it("is 15 minutes at the threshold, doubles per further failure and stops at 24 hours", () => {
        const minutes = (n) => lockDurationMs(n) / 60_000;
        expect([5, 6, 7, 8].map(minutes)).toEqual([15, 30, 60, 120]);
        expect(lockDurationMs(11)).toBe(16 * 3_600_000);
        expect(lockDurationMs(12)).toBe(LOCKOUT.MAX_MS);
        expect(lockDurationMs(500)).toBe(LOCKOUT.MAX_MS);
        expect(lockDurationMs(1)).toBe(LOCKOUT.BASE_MS);
    });
});

describe("recordFailure", () => {
    it("counts failures without locking until the 5th", async () => {
        const result = await fail(4);
        expect(result).toMatchObject({
            count: 4,
            lockUntil: null,
            justLocked: false,
        });
        expect(await getActiveLock(keys())).toBeNull();
    });

    it("locks for 15 minutes on the 5th failure and reports justLocked once", async () => {
        const now = new Date("2026-10-26T10:00:00Z");
        const fifth = await fail(5, keys(), now);
        expect(fifth.justLocked).toBe(true);
        expect(fifth.lockUntil).toEqual(new Date("2026-10-26T10:15:00Z"));
        const sixth = await recordFailure(keys(), now);
        expect(sixth.justLocked).toBe(false);
        expect(sixth.lockUntil).toEqual(new Date("2026-10-26T10:30:00Z"));
    });

    it("counts an unknown email exactly like a real one and stores no raw identifiers", async () => {
        await fail(1, keys("nobody@example.test"));
        const rows = await LoginAttempt.find({}).limit(5).lean();
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.kind).sort()).toEqual(["email", "ip"]);
        expect(JSON.stringify(rows)).not.toMatch(/nobody|@example/);
    });

    it("counts concurrent first failures without losing any (unique key race)", async () => {
        const results = await Promise.all(
            Array.from({ length: 5 }, () => recordFailure(keys()))
        );
        expect(results.map((result) => result.count).sort()).toEqual([
            1, 2, 3, 4, 5,
        ]);
        expect(results.filter((result) => result.justLocked)).toHaveLength(1);
    });

    it("works without an IP key", async () => {
        const result = await recordFailure({ emailKey: keys().emailKey });
        expect(result.count).toBe(1);
        expect(await LoginAttempt.countDocuments({ kind: "ip" })).toBe(0);
    });
});

describe("getActiveLock", () => {
    it("returns the lock with retryAfterSec while it lasts and nothing once it ended (fake clock)", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        await fail(5);
        const lock = await getActiveLock(keys());
        expect(lock.retryAfterSec).toBe(900);
        vi.setSystemTime(new Date("2026-10-26T10:10:00Z"));
        expect((await getActiveLock(keys())).retryAfterSec).toBe(300);
        vi.setSystemTime(new Date("2026-10-26T10:15:01Z"));
        expect(await getActiveLock(keys())).toBeNull();
    });

    it("is identical for a real and an unknown email with the same history", async () => {
        const now = new Date();
        await fail(5, keys("real@example.test", "1".repeat(64)), now);
        await fail(5, keys("fake@example.test", "2".repeat(64)), now);
        const real = await getActiveLock(
            { emailKey: emailAttemptKey("real@example.test", config) },
            now
        );
        const fake = await getActiveLock(
            { emailKey: emailAttemptKey("fake@example.test", config) },
            now
        );
        expect(real.retryAfterSec).toBe(fake.retryAfterSec);
    });

    it("locks an IP that fails too often across different emails", async () => {
        const ip = "9".repeat(64);
        await LoginAttempt.create({
            keyHash: ip,
            kind: "ip",
            count: LOCKOUT.IP_THRESHOLD - 1,
            firstAttemptAt: new Date(),
            lastAttemptAt: new Date(),
        });
        expect(
            await getActiveLock({
                emailKey: keys("a@example.test").emailKey,
                ipKey: ip,
            })
        ).toBeNull();
        await recordFailure({
            emailKey: keys("a@example.test").emailKey,
            ipKey: ip,
        });
        const lock = await getActiveLock({
            emailKey: keys("b@example.test").emailKey,
            ipKey: ip,
        });
        expect(lock.retryAfterSec).toBeGreaterThan(0);
    });
});

describe("clearEmailAttempts", () => {
    it("forgets the email failures and keeps the IP counter", async () => {
        await fail(5);
        await clearEmailAttempts(keys().emailKey);
        expect(await getActiveLock({ emailKey: keys().emailKey })).toBeNull();
        expect(await LoginAttempt.countDocuments({ kind: "ip" })).toBe(1);
        expect((await recordFailure(keys())).count).toBe(1);
    });
});
