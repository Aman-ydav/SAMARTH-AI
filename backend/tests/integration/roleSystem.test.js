// How each of the four roles comes into being and signs in (R68, doc 20 section 1), end to end over HTTP.
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { tokenOf } from "#integrations/email/memory.adapter.js";
import { syncPlatformAdmins } from "#modules/admin/index.js";
import { User } from "#modules/users/user.model.js";
import { createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import {
    buildAuthApp,
    loginAs,
    registerAndVerify,
} from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken } from "#tests/helpers/outbox.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const ENV_PASSWORD = "Granite-Orchid-Lantern-81";
const CHOSEN = "Chosen-By-The-Owner-Passphrase-55";
const LEARNER_PASSWORD = "Sturdy-Meadow-Lantern-Quartz-55";
const quiet = { info() {}, warn() {}, error() {} };

const syncFor = (built) =>
    syncPlatformAdmins({
        config: built.config,
        log: quiet,
        emailService: built.emailService,
    }).then(async (counts) => {
        await built.emailService.whenSettled();
        return counts;
    });

describe("learners create their own accounts and can never choose a role", () => {
    it("registration ignores nothing: any privileged field is refused and no account appears", async () => {
        const { app } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "100" },
        });
        const agent = await createAuthAgent(app);
        const base = {
            name: "Eve Hacker",
            email: "eve@example.test",
            password: LEARNER_PASSWORD,
            acceptTerms: true,
        };
        for (const extra of [
            { role: "superadmin" },
            { role: "admin" },
            { orgId: "000000000000000000000002" },
            { status: "active" },
            { emailVerified: true },
            { mustChangePassword: false },
        ]) {
            expectError(
                await agent
                    .post("/api/v1/auth/register")
                    .send({ ...base, ...extra }),
                400,
                "VALIDATION_ERROR"
            );
        }
        expect(await User.countDocuments({})).toBe(0);
    });

    it("a normal sign-up and verification makes a learner, who is refused by every /admin route", async () => {
        const built = buildAuthApp();
        const { agent, response } = await registerAndVerify(
            built.app,
            built.emailService,
            {
                email: "ana@example.test",
                password: LEARNER_PASSWORD,
            }
        );
        expect(response.body.data.user.role).toBe("learner");
        expectError(await agent.get("/api/v1/admin/users"), 403, "FORBIDDEN");
        expectError(
            await agent
                .post("/api/v1/admin/invites")
                .send({ email: "x@example.test", role: "trainer" }),
            403,
            "FORBIDDEN"
        );
        expectError(
            await agent.put("/api/v1/profile").send({ role: "admin" }),
            400,
            "VALIDATION_ERROR"
        );
        expect(
            (await User.findOne({ email: "ana@example.test" }).lean()).role
        ).toBe("learner");
    });

    it("Google sign-in creates a learner and refuses a role in the body", async () => {
        const verifyGoogleCredential = vi.fn().mockResolvedValue({
            sub: "g-1",
            email: "gina@example.test",
            name: "Gina Google",
        });
        const { app } = buildAuthApp({ verifyGoogleCredential });
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post("/api/v1/auth/google")
                .send({ credential: "google-credential-value", role: "admin" }),
            400,
            "VALIDATION_ERROR"
        );
        expectSuccess(
            await agent
                .post("/api/v1/auth/google")
                .send({ credential: "google-credential-value" })
        );
        expect(
            (await User.findOne({ email: "gina@example.test" }).lean()).role
        ).toBe("learner");
    });
});

describe("trainers and admins exist only because someone invited them", () => {
    it("a platform admin invites an admin, who invites a trainer; each signs in with the invited role", async () => {
        const built = buildAuthApp();
        const { app, emailService } = built;
        const platform = await createUser({ role: "superadmin" });
        const asPlatform = await loginAs(app, platform.email);
        expectSuccess(
            await asPlatform.agent
                .post("/api/v1/admin/invites")
                .send({ email: "boss@example.test", role: "admin" }),
            201
        );
        await emailService.whenSettled();
        const adminToken = tokenOf(
            emailService.outbox.latest({
                to: "boss@example.test",
                templateKey: "invite",
            })
        );
        const visitor = await createAuthAgent(app);
        const accepted = expectSuccess(
            await visitor.post("/api/v1/auth/accept-invite").send({
                token: adminToken,
                name: "New Boss",
                password: LEARNER_PASSWORD,
            })
        );
        expect(accepted.data.user.role).toBe("admin");

        const asAdmin = await loginAs(
            app,
            "boss@example.test",
            LEARNER_PASSWORD
        );
        expect(asAdmin.response.body.data.user.role).toBe("admin");
        expectSuccess(
            await asAdmin.agent
                .post("/api/v1/admin/invites")
                .send({ email: "coach@example.test", role: "trainer" }),
            201
        );
        expectError(
            await asAdmin.agent
                .post("/api/v1/admin/invites")
                .send({ email: "other@example.test", role: "admin" }),
            403,
            "FORBIDDEN"
        );
        await emailService.whenSettled();
        const trainerToken = tokenOf(
            emailService.outbox.latest({
                to: "coach@example.test",
                templateKey: "invite",
            })
        );
        await (
            await createAuthAgent(app)
        )
            .post("/api/v1/auth/accept-invite")
            .send({
                token: trainerToken,
                name: "New Coach",
                password: LEARNER_PASSWORD,
            });
        const asTrainer = await loginAs(
            app,
            "coach@example.test",
            LEARNER_PASSWORD
        );
        expect(asTrainer.response.body.data.user.role).toBe("trainer");
        expectError(
            await asTrainer.agent
                .post("/api/v1/admin/invites")
                .send({ email: "z@example.test", role: "trainer" }),
            403,
            "FORBIDDEN"
        );
    });

    it("an invite cannot carry a role into the accept call, and an unknown address cannot register as staff", async () => {
        const { app, emailService } = buildAuthApp();
        const platform = await createUser({ role: "superadmin" });
        const asPlatform = await loginAs(app, platform.email);
        await asPlatform.agent
            .post("/api/v1/admin/invites")
            .send({ email: "coach@example.test", role: "trainer" });
        await emailService.whenSettled();
        const token = tokenOf(
            emailService.outbox.latest({
                to: "coach@example.test",
                templateKey: "invite",
            })
        );
        const visitor = await createAuthAgent(app);
        expectError(
            await visitor.post("/api/v1/auth/accept-invite").send({
                token,
                name: "Coach",
                password: LEARNER_PASSWORD,
                role: "superadmin",
            }),
            400,
            "VALIDATION_ERROR"
        );
        const accepted = expectSuccess(
            await visitor
                .post("/api/v1/auth/accept-invite")
                .send({ token, name: "Coach", password: LEARNER_PASSWORD })
        );
        expect(accepted.data.user.role).toBe("trainer");
    });
});

describe("platform admins come from PLATFORM_ADMINS", () => {
    it("an entry without a password gets one set-password link; after choosing a password the person signs in as a platform admin", async () => {
        const built = buildAuthApp({
            env: { PLATFORM_ADMINS: "ops@example.test" },
        });
        expect(await syncFor(built)).toMatchObject({ created: 1 });
        const token = latestToken(
            built.emailService,
            "ops@example.test",
            "password-reset"
        );
        expect(token).toBeTruthy();
        // Before the password exists nobody can sign in, even with the address as the password.
        expectError(
            (await loginAs(built.app, "ops@example.test", "ops@example.test"))
                .response,
            401,
            "INVALID_CREDENTIALS"
        );

        const visitor = await createAuthAgent(built.app);
        expectSuccess(
            await visitor
                .post("/api/v1/auth/reset-password")
                .send({ token, newPassword: CHOSEN })
        );
        const { agent, response } = await loginAs(
            built.app,
            "ops@example.test",
            CHOSEN
        );
        expect(response.body.data.user).toMatchObject({
            role: "superadmin",
            mustChangePassword: false,
        });
        expectSuccess(await agent.get("/api/v1/admin/users"));
        await syncFor(built);
        expect(
            built.emailService.outbox.find({
                to: "ops@example.test",
                templateKey: "password-reset",
            })
        ).toHaveLength(1);
    });

    it("an entry with a password signs in with a limited session until the password is changed", async () => {
        const built = buildAuthApp({
            env: { PLATFORM_ADMINS: `root@example.test:${ENV_PASSWORD}` },
        });
        await syncFor(built);
        const { agent, response } = await loginAs(
            built.app,
            "root@example.test",
            ENV_PASSWORD
        );
        expect(response.body.data.user).toMatchObject({
            role: "superadmin",
            mustChangePassword: true,
        });
        expectError(
            await agent.get("/api/v1/admin/users"),
            403,
            "MUST_CHANGE_PASSWORD"
        );
        const changed = await agent
            .post("/api/v1/auth/change-password")
            .send({ currentPassword: ENV_PASSWORD, newPassword: CHOSEN });
        expect(changed.status).toBe(200);
        expectSuccess(await agent.get("/api/v1/admin/users"));
        // The env value no longer works, and a restart does not bring it back.
        await syncFor(built);
        expectError(
            (await loginAs(built.app, "root@example.test", ENV_PASSWORD))
                .response,
            401,
            "INVALID_CREDENTIALS"
        );
    });

    it("a password-less platform admin can ask for a new link through Forgot password", async () => {
        const built = buildAuthApp({
            env: { PLATFORM_ADMINS: "ops@example.test" },
        });
        await syncFor(built);
        built.emailService.outbox.clear();
        const visitor = await createAuthAgent(built.app);
        expect(
            (
                await visitor
                    .post("/api/v1/auth/forgot-password")
                    .send({ email: "ops@example.test" })
            ).status
        ).toBe(200);
        const { whenBackgroundIdle } =
            await import("#utils/backgroundTasks.js");
        await whenBackgroundIdle();
        await built.emailService.whenSettled();
        expect(
            latestToken(
                built.emailService,
                "ops@example.test",
                "password-reset"
            )
        ).toBeTruthy();
    });

    it("several platform admins coexist; an existing verified account is promoted and has to sign in again", async () => {
        const built = buildAuthApp({
            env: {
                PLATFORM_ADMINS: `one@example.test:${ENV_PASSWORD}, two@example.test, learner@example.test`,
            },
        });
        const learner = await createUser({
            email: "learner@example.test",
            role: "learner",
        });
        const before = await loginAs(built.app, learner.email);
        expectError(
            await before.agent.get("/api/v1/admin/users"),
            403,
            "FORBIDDEN"
        );
        expect(await syncFor(built)).toMatchObject({ created: 2, promoted: 1 });
        expect(await User.countDocuments({ role: "superadmin" })).toBe(3);
        expect((await before.agent.get("/api/v1/admin/users")).status).toBe(
            401
        );
        const after = await loginAs(built.app, learner.email);
        expect(after.response.body.data.user.role).toBe("superadmin");
        expectSuccess(await after.agent.get("/api/v1/admin/users"));
    });
});
