import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    createMemoryTransport,
    tokenOf,
} from "#integrations/email/memory.adapter.js";
import { AuditLog } from "#modules/audit/auditLog.model.js";
import { AuthToken } from "#modules/auth/authToken.model.js";
import { RefreshSession } from "#modules/auth/refreshSession.model.js";
import { createSession } from "#modules/auth/session.service.js";
import { User } from "#modules/users/user.model.js";
import { createEmailService } from "#services/email.service.js";
import { createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { syncPlatformAdmins } from "./platformAdmins.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const PASSWORD = "Granite-Orchid-Lantern-81";
const quiet = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const configFor = (entries, extra = {}) => ({
    ...makeTestEnv(extra),
    platformAdmins: entries,
});
const mailer = (config = makeTestEnv()) =>
    createEmailService({ config, transport: createMemoryTransport() });
const everythingLogged = (log) =>
    JSON.stringify([
        log.info.mock.calls,
        log.warn.mock.calls,
        log.error.mock.calls,
    ]);

async function run(entries, { log = quiet(), emailService, extra } = {}) {
    const service = emailService ?? mailer();
    const counts = await syncPlatformAdmins({
        config: configFor(entries, extra),
        log,
        emailService: service,
    });
    await service.whenSettled();
    return { counts, log, emailService: service };
}

describe("syncPlatformAdmins: new accounts", () => {
    it("creates a superadmin with a password: active, verified, hashed, must change it, audited, no mail", async () => {
        const { counts, log, emailService } = await run([
            { email: "root@example.test", password: PASSWORD },
        ]);
        expect(counts).toMatchObject({ created: 1, failed: 0 });
        const user = await User.findOne({ email: "root@example.test" })
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
        expect(String(user.orgId)).toBe("000000000000000000000001");
        expect(user.passwordHash).toMatch(/^\$2b\$12\$/);
        expect(user.passwordHash).not.toContain(PASSWORD);
        expect(emailService.outbox.find({})).toHaveLength(0);
        expect(
            await AuditLog.countDocuments({
                action: "PLATFORM_ADMIN_CREATED",
                entityId: user._id,
            })
        ).toBe(1);
        expect(everythingLogged(log)).not.toContain(PASSWORD);
    });

    it("creates a superadmin without a password and sends exactly ONE set-password mail", async () => {
        const { counts, emailService } = await run([
            { email: "ops@example.test" },
        ]);
        expect(counts.created).toBe(1);
        const user = await User.findOne({ email: "ops@example.test" })
            .select("+passwordHash")
            .lean();
        expect(user).toMatchObject({
            role: "superadmin",
            status: "active",
            emailVerified: true,
            mustChangePassword: false,
        });
        expect(user.passwordHash).toBeUndefined();
        const mails = emailService.outbox.find({ to: "ops@example.test" });
        expect(mails).toHaveLength(1);
        expect(mails[0]).toMatchObject({
            templateKey: "password-reset",
            data: { variant: "setup", expiresIn: "30 minutes" },
        });
        expect(mails[0].data.link).toMatch(/\/reset-password#token=/);
        const record = await AuthToken.findOne({ userId: user._id }).lean();
        expect(record).toMatchObject({ type: "passwordReset" });
        expect(tokenOf(mails[0])).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("is idempotent: a second start changes nothing and sends no second mail", async () => {
        const entries = [
            { email: "ops@example.test" },
            { email: "root@example.test", password: PASSWORD },
        ];
        const emailService = mailer();
        await run(entries, { emailService });
        const before = await User.find({}).select("+passwordHash").lean();
        const second = await run(entries, { emailService });
        expect(second.counts).toMatchObject({
            created: 0,
            unchanged: 2,
            failed: 0,
        });
        expect(await User.find({}).select("+passwordHash").lean()).toEqual(
            before
        );
        expect(emailService.outbox.find({})).toHaveLength(1);
        expect(
            await AuditLog.countDocuments({ action: "PLATFORM_ADMIN_CREATED" })
        ).toBe(2);
    });

    it("never overwrites the password of an existing platform admin, and never re-sends the mail", async () => {
        await run([{ email: "root@example.test", password: PASSWORD }]);
        await User.updateOne(
            { email: "root@example.test" },
            { passwordHash: "changed-by-the-owner" }
        );
        const { counts, emailService } = await run([
            { email: "root@example.test", password: "Another-Env-Value-4242" },
        ]);
        expect(counts.unchanged).toBe(1);
        expect(
            (
                await User.findOne({ email: "root@example.test" })
                    .select("+passwordHash")
                    .lean()
            ).passwordHash
        ).toBe("changed-by-the-owner");
        expect(emailService.outbox.find({})).toHaveLength(0);
    });

    it("creates several entries in one run", async () => {
        const { counts } = await run([
            { email: "a@example.test" },
            { email: "b@example.test", password: PASSWORD },
            { email: "c@example.test" },
        ]);
        expect(counts.created).toBe(3);
        expect(await User.countDocuments({ role: "superadmin" })).toBe(3);
    });

    it("a bad entry fails alone: the others are still created and nothing sensitive is logged", async () => {
        const weak = "password1234";
        const { counts, log } = await run([
            { email: "good1@example.test", password: PASSWORD },
            { email: "weak@example.test", password: weak },
            { email: "good2@example.test" },
        ]);
        expect(counts).toMatchObject({ created: 2, failed: 1 });
        expect(await User.exists({ email: "weak@example.test" })).toBeNull();
        expect(log.error).toHaveBeenCalledTimes(1);
        const text = everythingLogged(log);
        for (const secret of [weak, PASSWORD, "weak@example.test"]) {
            expect(text).not.toContain(secret);
        }
        expect(text).toContain("PASSWORD_POLICY");
    });

    it("a database error on one entry is logged without the password and does not stop the next entry", async () => {
        const spy = vi
            .spyOn(User, "updateOne")
            .mockRejectedValueOnce(new Error(`boom ${PASSWORD}`));
        const { counts, log } = await run([
            { email: "first@example.test", password: PASSWORD },
            { email: "second@example.test" },
        ]);
        spy.mockRestore();
        expect(counts).toMatchObject({ failed: 1, created: 1 });
        expect(
            await User.exists({ email: "second@example.test" })
        ).toBeTruthy();
        expect(everythingLogged(log)).not.toContain(PASSWORD);
        expect(everythingLogged(log)).toContain("[redacted]");
    });

    it("several instances starting at once create exactly one account and send exactly one mail", async () => {
        const emailService = mailer();
        const results = await Promise.all(
            [1, 2, 3].map(() =>
                syncPlatformAdmins({
                    config: configFor([{ email: "ops@example.test" }]),
                    log: quiet(),
                    emailService,
                })
            )
        );
        await emailService.whenSettled();
        expect(results.reduce((sum, counts) => sum + counts.created, 0)).toBe(
            1
        );
        expect(await User.countDocuments({ email: "ops@example.test" })).toBe(
            1
        );
        expect(emailService.outbox.find({})).toHaveLength(1);
        expect(
            await AuditLog.countDocuments({ action: "PLATFORM_ADMIN_CREATED" })
        ).toBe(1);
    });

    it("works with the production configuration and ignores ALLOWED_EMAIL_DOMAINS (the owner controls the env)", async () => {
        const config = {
            ...makeTestEnv({
                NODE_ENV: "production",
                ALLOWED_EMAIL_DOMAINS: "gov.in",
            }),
            platformAdmins: [{ email: "ops@example.test" }],
        };
        expect(config.isProduction).toBe(true);
        const service = createEmailService({
            config,
            transport: createMemoryTransport(),
        });
        const counts = await syncPlatformAdmins({
            config,
            log: quiet(),
            emailService: service,
        });
        await service.whenSettled();
        expect(counts.created).toBe(1);
        expect(service.outbox.find({ to: "ops@example.test" })).toHaveLength(1);
    });
});

describe("syncPlatformAdmins: existing accounts", () => {
    it("promotes a verified, active account, bumps the token version, revokes its sessions and audits the change", async () => {
        const user = await createUser({
            email: "learner@example.test",
            role: "learner",
        });
        await createSession({ user, ctx: makeAuthCtx() });
        await createSession({ user, ctx: makeAuthCtx() });
        const before = await User.findById(user._id).lean();

        const { counts, log } = await run([{ email: "Learner@Example.test" }]);

        expect(counts).toMatchObject({ promoted: 1, created: 0 });
        const after = await User.findById(user._id)
            .select("+passwordHash")
            .lean();
        expect(after.role).toBe("superadmin");
        expect(after.tokenVersion).toBe(before.tokenVersion + 1);
        expect(after.passwordHash).toBe(
            (await User.findById(user._id).select("+passwordHash").lean())
                .passwordHash
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedReason: "admin",
            })
        ).toBe(2);
        const entry = await AuditLog.findOne({
            action: "ROLE_CHANGED",
            entityId: user._id,
        }).lean();
        expect(entry.meta).toEqual({
            from: "learner",
            to: "superadmin",
            source: "platform_admins",
        });
        expect(everythingLogged(log)).not.toContain("learner@example.test");
    });

    it("keeps the password of a promoted account even when the entry carries one, and sends no mail", async () => {
        const user = await createUser({
            email: "trainer@example.test",
            role: "trainer",
        });
        const hash = (
            await User.findById(user._id).select("+passwordHash").lean()
        ).passwordHash;
        const { emailService } = await run([
            { email: "trainer@example.test", password: PASSWORD },
        ]);
        const after = await User.findById(user._id)
            .select("+passwordHash")
            .lean();
        expect(after.role).toBe("superadmin");
        expect(after.passwordHash).toBe(hash);
        expect(after.mustChangePassword).toBe(false);
        expect(emailService.outbox.find({})).toHaveLength(0);
    });

    it.each([
        [
            "unverified",
            { emailVerified: false, status: "pending_verification" },
        ],
        ["suspended", { status: "suspended" }],
        ["deactivated", { status: "deactivated" }],
    ])(
        "does not promote a %s account and logs a warning",
        async (_label, state) => {
            const user = await createUser({
                email: "wait@example.test",
                ...state,
            });
            const { counts, log } = await run([{ email: "wait@example.test" }]);
            expect(counts).toMatchObject({
                skipped: 1,
                promoted: 0,
                failed: 0,
            });
            expect((await User.findById(user._id).lean()).role).toBe("learner");
            expect(log.warn).toHaveBeenCalledTimes(1);
            expect(everythingLogged(log)).not.toContain("wait@example.test");
            expect(await AuditLog.countDocuments({})).toBe(0);
        }
    );

    it("leaves an existing platform admin alone, and removing an entry never demotes anyone", async () => {
        await run([{ email: "root@example.test", password: PASSWORD }]);
        const log = quiet();
        const none = await syncPlatformAdmins({
            config: configFor([]),
            log,
            emailService: mailer(),
        });
        expect(none).toMatchObject({ created: 0, promoted: 0, failed: 0 });
        expect(log.warn).toHaveBeenCalled();
        expect(
            (await User.findOne({ email: "root@example.test" }).lean()).role
        ).toBe("superadmin");
        const { counts } = await run([{ email: "other@example.test" }]);
        expect(counts.created).toBe(1);
        expect(await User.countDocuments({ role: "superadmin" })).toBe(2);
    });

    it("promotion is race-safe: two simultaneous syncs promote once", async () => {
        const user = await createUser({ email: "dual@example.test" });
        const results = await Promise.all(
            [1, 2].map(() =>
                syncPlatformAdmins({
                    config: configFor([{ email: "dual@example.test" }]),
                    log: quiet(),
                    emailService: mailer(),
                })
            )
        );
        expect(results.reduce((sum, c) => sum + c.promoted, 0)).toBe(1);
        expect((await User.findById(user._id).lean()).tokenVersion).toBe(1);
        expect(await AuditLog.countDocuments({ action: "ROLE_CHANGED" })).toBe(
            1
        );
    });
});
