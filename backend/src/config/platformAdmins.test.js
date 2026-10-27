import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "./env.js";
import {
    MAX_PLATFORM_ADMINS,
    mergePlatformAdmins,
    parsePlatformAdmins,
} from "./platformAdmins.js";

const STRONG = "Granite-Orchid-Lantern-81";
const devEnv = (overrides = {}) => ({
    NODE_ENV: "development",
    FRONTEND_URL: "http://localhost:5173",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    MONGODB_URI: "mongodb://127.0.0.1:27017/SamarthAI",
    ACCESS_TOKEN_SECRET: "a".repeat(40),
    REFRESH_TOKEN_SECRET: "b".repeat(40),
    IDENTIFIER_HASH_SECRET: "c".repeat(40),
    ...overrides,
});
const issuesOf = (raw) => {
    try {
        parseEnv(raw);
    } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError);
        return error.issues.join("\n") + "\n" + error.message;
    }
    return "";
};

describe("parsePlatformAdmins (R68)", () => {
    it("reads plain emails and email:password entries", () => {
        expect(
            parsePlatformAdmins(`ops@example.test, root@example.test:${STRONG}`)
        ).toEqual({
            entries: [
                { email: "ops@example.test" },
                { email: "root@example.test", password: STRONG },
            ],
            issues: [],
        });
    });

    it("trims spaces, lower-cases and NFKC-normalises emails, ignores empty entries", () => {
        const { entries, issues } = parsePlatformAdmins(
            `  ,Ops.Admin@EXAMPLE.test ,, \t,ＲＯＯＴ@example.test :  ${STRONG}  ,`
        );
        expect(issues).toEqual([]);
        expect(entries).toEqual([
            { email: "ops.admin@example.test" },
            { email: "root@example.test", password: STRONG },
        ]);
    });

    it("splits at the FIRST colon only, so the password may contain colons", () => {
        const password = "pass:with:colons:Quartz-99";
        const { entries, issues } = parsePlatformAdmins(
            `root@example.test:${password}`
        );
        expect(issues).toEqual([]);
        expect(entries[0].password).toBe(password);
    });

    it("keeps the first of a repeated email (case-insensitive) and drops the rest", () => {
        const { entries } = parsePlatformAdmins(
            `a@example.test, A@Example.test:${STRONG}, b@example.test, a@example.test`
        );
        expect(entries).toEqual([
            { email: "a@example.test" },
            { email: "b@example.test" },
        ]);
    });

    it("returns nothing for an empty or whitespace value", () => {
        expect(parsePlatformAdmins("")).toEqual({ entries: [], issues: [] });
        expect(parsePlatformAdmins(" , ,, ")).toEqual({
            entries: [],
            issues: [],
        });
        expect(parsePlatformAdmins()).toEqual({ entries: [], issues: [] });
    });

    it.each([
        ["not-an-email", "the email address is not valid"],
        ["@example.test", "the email address is not valid"],
        ["root@example.test:", "a colon is followed by no password"],
        ["root@example.test:short", "shorter than 10"],
        [`root@example.test:${"x".repeat(80)}`, "longer than 72 bytes"],
        [`root@example.test:${"é".repeat(40)}`, "longer than 72 bytes"],
        ["root@example.test:root@example.test", "must not contain the email"],
        [
            "operator@example.test:My-Operator-Pass-77",
            "must not contain the email address or its name part",
        ],
        ["root@example.test:abc\u0007defghijklmn", "control characters"],
    ])("rejects %j", (entry, fragment) => {
        const { entries, issues } = parsePlatformAdmins(entry);
        expect(entries).toEqual([]);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatch(/^entry 1: /);
        expect(issues[0]).toContain(fragment);
    });

    it("numbers the offending entry among the non-empty ones and never echoes any value", () => {
        const { issues } = parsePlatformAdmins(
            `ok@example.test, , bad-address:${STRONG}, root@example.test:short`
        );
        expect(issues).toHaveLength(2);
        expect(issues[0]).toMatch(/^entry 2:/);
        expect(issues[1]).toMatch(/^entry 3:/);
        expect(issues.join()).not.toContain(STRONG);
        expect(issues.join()).not.toContain("bad-address");
        expect(issues.join()).not.toContain("root@example.test");
    });

    it(`accepts ${MAX_PLATFORM_ADMINS} entries and refuses an 11th`, () => {
        const list = (count) =>
            Array.from({ length: count }, (_, i) => `admin${i}@example.test`);
        expect(parsePlatformAdmins(list(10).join(",")).issues).toEqual([]);
        const eleven = parsePlatformAdmins(list(11).join(","));
        expect(eleven.issues).toEqual([
            "at most 10 platform admins are allowed",
        ]);
        // Repeats do not count towards the cap.
        expect(
            parsePlatformAdmins([...list(10), ...list(10)].join(",")).issues
        ).toEqual([]);
    });
});

describe("mergePlatformAdmins (legacy SEED_ADMIN pair)", () => {
    it("adds the legacy pair as one more entry, normalised", () => {
        expect(
            mergePlatformAdmins([{ email: "a@example.test" }], {
                email: "Seed@Example.TEST",
                password: STRONG,
            })
        ).toEqual([
            { email: "a@example.test" },
            { email: "seed@example.test", password: STRONG },
        ]);
    });

    it("needs both variables, and the listed entry wins for the same email", () => {
        expect(mergePlatformAdmins([], { email: "seed@example.test" })).toEqual(
            []
        );
        expect(mergePlatformAdmins([], { password: STRONG })).toEqual([]);
        expect(
            mergePlatformAdmins([{ email: "seed@example.test" }], {
                email: "SEED@example.test",
                password: STRONG,
            })
        ).toEqual([{ email: "seed@example.test" }]);
        expect(mergePlatformAdmins()).toEqual([]);
    });
});

describe("PLATFORM_ADMINS through parseEnv", () => {
    it("is optional and defaults to no platform admins", () => {
        expect(parseEnv(devEnv()).platformAdmins).toEqual([]);
        expect(
            parseEnv(devEnv({ PLATFORM_ADMINS: "  " })).platformAdmins
        ).toEqual([]);
    });

    it("builds a frozen list, with the legacy pair appended last", () => {
        const config = parseEnv(
            devEnv({
                PLATFORM_ADMINS: `One@Example.test, two@example.test:${STRONG}`,
                SEED_ADMIN_EMAIL: "legacy@example.test",
                SEED_ADMIN_PASSWORD: "Legacy-Seed-Phrase-2026",
            })
        );
        expect(config.platformAdmins.map((entry) => entry.email)).toEqual([
            "one@example.test",
            "two@example.test",
            "legacy@example.test",
        ]);
        expect(Object.isFrozen(config.platformAdmins)).toBe(true);
        expect(Object.isFrozen(config.platformAdmins[1])).toBe(true);
    });

    it("works in production too", () => {
        const config = parseEnv(
            devEnv({
                NODE_ENV: "production",
                FRONTEND_URL: "https://app.example.test",
                CORS_ALLOWED_ORIGINS: "https://app.example.test",
                EMAIL_TRANSPORT: "log",
                CLOUDINARY_CLOUD_NAME: "cloud",
                CLOUDINARY_API_KEY: "key",
                CLOUDINARY_API_SECRET: "cloud-secret",
                GOOGLE_CLIENT_ID: "client-id",
                PLATFORM_ADMINS: "ops@example.test",
            })
        );
        expect(config.platformAdmins).toEqual([{ email: "ops@example.test" }]);
    });

    it("stops boot on a malformed entry with an error that never prints the password or the address", () => {
        const text = issuesOf(
            devEnv({
                PLATFORM_ADMINS: `fine@example.test, broken-entry:${STRONG}, root@example.test:short-pw`,
            })
        );
        expect(text).toContain(
            "PLATFORM_ADMINS: entry 2: the email address is not valid"
        );
        expect(text).toContain(
            "PLATFORM_ADMINS: entry 3: password is shorter than 10"
        );
        for (const secret of [
            STRONG,
            "broken-entry",
            "short-pw",
            "fine@example",
        ]) {
            expect(text).not.toContain(secret);
        }
    });

    it("refuses a password equal to the email address (the product owner's request is rejected on purpose)", () => {
        const text = issuesOf(
            devEnv({
                PLATFORM_ADMINS:
                    "boss.person@example.test:boss.person@example.test",
            })
        );
        expect(text).toContain("must not contain the email");
        expect(text).not.toContain("boss.person");
    });

    it("refuses 11 entries, and 10 listed plus the legacy pair", () => {
        const list = Array.from(
            { length: 11 },
            (_, i) => `admin${i}@example.test`
        );
        expect(issuesOf(devEnv({ PLATFORM_ADMINS: list.join(",") }))).toContain(
            "at most 10 platform admins"
        );
        expect(
            issuesOf(
                devEnv({
                    PLATFORM_ADMINS: list.slice(0, 10).join(","),
                    SEED_ADMIN_EMAIL: "legacy@example.test",
                    SEED_ADMIN_PASSWORD: "Legacy-Seed-Phrase-2026",
                })
            )
        ).toContain("counting the legacy SEED_ADMIN_EMAIL entry");
        expect(
            issuesOf(devEnv({ PLATFORM_ADMINS: list.slice(0, 10).join(",") }))
        ).toBe("");
    });
});
