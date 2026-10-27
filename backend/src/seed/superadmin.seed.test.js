import { fileURLToPath } from "node:url";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { User } from "#modules/users/user.model.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { runSeeds } from "./runSeed.js";
import { seed } from "./superadmin.seed.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const quiet = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const configWith = (extra = {}) =>
    makeTestEnv({
        SEED_ADMIN_EMAIL: "Root.Admin@Example.TEST",
        SEED_ADMIN_PASSWORD: "Seeded-Passphrase-Value-1",
        ...extra,
    });

describe("superadmin seed (DB-36)", () => {
    it("creates one active, verified superadmin that must change its password", async () => {
        const log = quiet();
        await expect(
            seed({ log, config: configWith() })
        ).resolves.toMatchObject({ created: true });
        const user = await User.findOne({ email: "root.admin@example.test" })
            .select("+passwordHash")
            .lean();
        expect(user).toMatchObject({
            role: "superadmin",
            status: "active",
            emailVerified: true,
            mustChangePassword: true,
            authProviders: ["local"],
            name: "Platform admin",
        });
        expect(user.passwordHash).toMatch(/^\$2b\$12\$/);
        expect(user.passwordHash).not.toContain("Seeded-Passphrase");
        expect(String(user.orgId)).toBe("000000000000000000000001");
        expect(JSON.stringify(log.info.mock.calls)).not.toContain(
            "Seeded-Passphrase"
        );
    });

    it("is idempotent and never overwrites an existing account or its password", async () => {
        await seed({ log: quiet(), config: configWith() });
        await User.updateOne(
            { email: "root.admin@example.test" },
            { name: "Renamed", passwordHash: "changed-later" }
        );
        await expect(
            seed({ log: quiet(), config: configWith() })
        ).resolves.toMatchObject({ created: false });
        expect(await User.countDocuments({})).toBe(1);
        expect(
            await User.findOne({}).select("+passwordHash").lean()
        ).toMatchObject({ name: "Renamed", passwordHash: "changed-later" });
    });

    it("does nothing, with a warning, when the seed variables are missing", async () => {
        const log = quiet();
        await expect(seed({ log, config: makeTestEnv() })).resolves.toEqual({
            created: false,
            skipped: true,
        });
        expect(log.warn).toHaveBeenCalled();
        expect(await User.countDocuments({})).toBe(0);
    });

    it("seeds every PLATFORM_ADMINS entry and delivers the set-password mail before returning", async () => {
        const { emailService } = await import("#services/email.service.js");
        emailService.outbox.clear();
        const config = makeTestEnv({
            PLATFORM_ADMINS:
                "ops@example.test, root@example.test:Granite-Orchid-Lantern-81",
            ...{
                SEED_ADMIN_EMAIL: "legacy@example.test",
                SEED_ADMIN_PASSWORD: "Seeded-Passphrase-Value-1",
            },
        });
        const result = await seed({ log: quiet(), config });
        expect(result).toMatchObject({
            created: true,
            outcome: { created: 3 },
        });
        expect(await User.countDocuments({ role: "superadmin" })).toBe(3);
        expect(
            emailService.outbox.find({
                to: "ops@example.test",
                templateKey: "password-reset",
            })
        ).toHaveLength(1);
        await expect(seed({ log: quiet(), config })).resolves.toMatchObject({
            created: false,
            outcome: { unchanged: 3 },
        });
        expect(
            emailService.outbox.find({
                to: "ops@example.test",
                templateKey: "password-reset",
            })
        ).toHaveLength(1);
    });

    it("is picked up by the seed runner (and skips cleanly without the env variables)", async () => {
        const dir = fileURLToPath(new URL(".", import.meta.url));
        const ran = await runSeeds({
            dir,
            config: { isProduction: false },
            log: quiet(),
        });
        expect(ran).toContain("superadmin.seed.js");
        expect(await User.countDocuments({})).toBe(0);
    });
});
