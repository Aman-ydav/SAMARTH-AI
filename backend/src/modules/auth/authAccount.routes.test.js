// supertest route tests (TEST-08) for unlink Google, email change, account deletion and accept invite.
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
import { tokenOf } from "#integrations/email/memory.adapter.js";
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { makeAuthCtx } from "#tests/helpers/authCtx.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { createInvite } from "./invite.service.js";
import { RefreshSession } from "./refreshSession.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const NEW_EMAIL = "moved.here@example.test";

describe("DELETE /auth/google", () => {
    const credential = "google-credential-value-123";

    it("unlinks Google from an account that also has a password", async () => {
        const verify = vi.fn().mockResolvedValue({
            sub: "g-1",
            email: "x@example.test",
            name: "X",
        });
        const { app } = buildAuthApp({ verifyGoogleCredential: verify });
        const user = await createUser({
            googleSub: "g-1",
            authProviders: ["local", "google"],
        });
        const { agent } = await loginAs(app, user.email);
        const body = expectSuccess(
            await agent.delete(`${API}/google`).send({ credential })
        );
        expect(body.data.user.authProviders).toEqual(["local"]);
        expect(
            (await User.findById(user._id).lean()).googleSub
        ).toBeUndefined();
    });

    it("answers AUTH_METHOD_REQUIRED 409 when it is the last method, REAUTH_REQUIRED 403 for another Google account", async () => {
        const verify = vi.fn().mockResolvedValue({
            sub: "g-1",
            email: "x@example.test",
            name: "X",
        });
        const { app } = buildAuthApp({ verifyGoogleCredential: verify });
        const googleOnly = await createUser({
            googleSub: "g-1",
            authProviders: ["google"],
            passwordHash: null,
        });
        const session = await createAuthAgent(app);
        await session.post(`${API}/google`).send({ credential });
        expectError(
            await session.delete(`${API}/google`).send({ credential }),
            409,
            "AUTH_METHOD_REQUIRED"
        );

        verify.mockResolvedValue({
            sub: "someone-else",
            email: "x@example.test",
            name: "X",
        });
        await User.updateOne(
            { _id: googleOnly._id },
            { passwordHash: "x".repeat(60), authProviders: ["local", "google"] }
        );
        expectError(
            await session.delete(`${API}/google`).send({ credential }),
            403,
            "REAUTH_REQUIRED"
        );
    });

    it("needs a session and a valid body", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous
                .delete(`${API}/google`)
                .send({ credential: "google-credential-value-123" }),
            401,
            "AUTH_REQUIRED"
        );
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.delete(`${API}/google`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent.delete(`${API}/google`).send({ credential: "short" }),
            400,
            "VALIDATION_ERROR"
        );
    });
});

describe("email change: POST /auth/change-email, /confirm and /undo", () => {
    async function requestChange(app, emailService, user) {
        const { agent } = await loginAs(app, user.email);
        const response = await agent
            .post(`${API}/change-email`)
            .send({ newEmail: NEW_EMAIL, currentPassword: TEST_PASSWORD });
        await emailService.whenSettled();
        return {
            agent,
            response,
            confirmToken: tokenOf(
                emailService.outbox.latest({
                    to: NEW_EMAIL,
                    templateKey: "email-change-confirm",
                })
            ),
            undoToken: tokenOf(
                emailService.outbox.latest({
                    to: user.email,
                    templateKey: "email-change-notice",
                })
            ),
        };
    }

    it("request answers 202 and mails both addresses; confirm applies; undo restores and revokes all sessions", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser({ email: "before.change@example.test" });
        const { agent, response, confirmToken } = await requestChange(
            app,
            emailService,
            user
        );
        expectSuccess(response, 202);
        expect((await User.findById(user._id).lean()).email).toBe(
            "before.change@example.test"
        );

        const anonymous = await createAuthAgent(app);
        expect(
            expectSuccess(
                await anonymous
                    .post(`${API}/change-email/confirm`)
                    .send({ token: confirmToken })
            ).data
        ).toEqual({ emailChanged: true });
        expect((await User.findById(user._id).lean()).email).toBe(NEW_EMAIL);

        await emailService.whenSettled();
        const freshUndo = tokenOf(
            emailService.outbox.latest({
                to: "before.change@example.test",
                templateKey: "email-change-notice",
            })
        );
        expectSuccess(
            await anonymous
                .post(`${API}/change-email/undo`)
                .send({ token: freshUndo })
        );
        expect((await User.findById(user._id).lean()).email).toBe(
            "before.change@example.test"
        );
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        await agent.prime();
        expect((await agent.get(`${API}/me`)).status).toBe(401);
    });

    it("request answers the same 202 when the address is taken (no existence leak) and sends nothing", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const taken = await createUser({ email: NEW_EMAIL });
        const { agent } = await loginAs(app, user.email);
        const response = await agent
            .post(`${API}/change-email`)
            .send({ newEmail: taken.email, currentPassword: TEST_PASSWORD });
        expectSuccess(response, 202);
        await emailService.whenSettled();
        expect(
            emailService.outbox.find({ templateKey: "email-change-confirm" })
        ).toHaveLength(0);
    });

    it("request re-authenticates, needs a session and validates", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous
                .post(`${API}/change-email`)
                .send({ newEmail: NEW_EMAIL, currentPassword: "x" }),
            401,
            "AUTH_REQUIRED"
        );
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.post(`${API}/change-email`).send({
                newEmail: NEW_EMAIL,
                currentPassword: "Wrong-Password-Value-1",
            }),
            401,
            "INVALID_CREDENTIALS"
        );
        expectError(
            await agent
                .post(`${API}/change-email`)
                .send({ newEmail: "nope", currentPassword: TEST_PASSWORD }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/change-email`)
                .send({ newEmail: NEW_EMAIL }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("request refuses a disallowed domain explicitly", async () => {
        const { app } = buildAuthApp({
            env: { ALLOWED_EMAIL_DOMAINS: "example.test" },
        });
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.post(`${API}/change-email`).send({
                newEmail: "x@gmail.example",
                currentPassword: TEST_PASSWORD,
            }),
            403,
            "DOMAIN_NOT_ALLOWED"
        );
    });

    it("confirm and undo answer EMAIL_CHANGE_INVALID for bad, reused and wrong-kind tokens; GET does not exist", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const { confirmToken, undoToken } = await requestChange(
            app,
            emailService,
            user
        );
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous
                .post(`${API}/change-email/confirm`)
                .send({ token: undoToken }),
            400,
            "EMAIL_CHANGE_INVALID"
        );
        expectError(
            await anonymous
                .post(`${API}/change-email/undo`)
                .send({ token: confirmToken }),
            400,
            "EMAIL_CHANGE_INVALID"
        );
        expectError(
            await anonymous
                .post(`${API}/change-email/confirm`)
                .send({ token: "garbage" }),
            400,
            "EMAIL_CHANGE_INVALID"
        );
        expectSuccess(
            await anonymous
                .post(`${API}/change-email/confirm`)
                .send({ token: confirmToken })
        );
        expectError(
            await anonymous
                .post(`${API}/change-email/confirm`)
                .send({ token: confirmToken }),
            400,
            "EMAIL_CHANGE_INVALID"
        );
        expectError(
            await anonymous.post(`${API}/change-email/confirm`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await anonymous.get(
                `${API}/change-email/confirm?token=${confirmToken}`
            ),
            404,
            "NOT_FOUND"
        );
        expectError(
            await anonymous.get(`${API}/change-email/undo`),
            404,
            "NOT_FOUND"
        );
    });
});

describe("DELETE /auth/account", () => {
    it("schedules deletion, ends every session and clears the cookies; logging in again reactivates", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const other = await loginAs(app, user.email);
        const response = await agent
            .delete(`${API}/account`)
            .send({ currentPassword: TEST_PASSWORD });
        const body = expectSuccess(response);
        expect(
            new Date(body.data.graceEndsAt).getTime() - Date.now()
        ).toBeGreaterThan(29 * 86_400_000);
        expect(response.headers["set-cookie"].join("\n")).toMatch(
            /sai_access=;/
        );
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "pending_deletion",
        });
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        await other.agent.prime();
        expect((await other.agent.get(`${API}/me`)).status).toBe(401);

        const back = await loginAs(app, user.email);
        expect(expectSuccess(back.response).data.reactivate).toBe(true);
        expect(await User.findById(user._id).lean()).toMatchObject({
            status: "active",
            deletionScheduledAt: null,
        });
    });

    it("re-authenticates and needs a session", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous
                .delete(`${API}/account`)
                .send({ currentPassword: "x" }),
            401,
            "AUTH_REQUIRED"
        );
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent
                .delete(`${API}/account`)
                .send({ currentPassword: "Wrong-Password-Value-1" }),
            401,
            "INVALID_CREDENTIALS"
        );
        expectError(
            await agent.delete(`${API}/account`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .delete(`${API}/account`)
                .send({ currentPassword: TEST_PASSWORD, extra: 1 }),
            400,
            "VALIDATION_ERROR"
        );
        expect((await User.findById(user._id).lean()).status).toBe("active");
    });

    it("refuses the last active admin with 409 LAST_ADMIN", async () => {
        const { app } = buildAuthApp();
        const admin = await createUser({ role: "admin" });
        const { agent } = await loginAs(app, admin.email);
        expectError(
            await agent
                .delete(`${API}/account`)
                .send({ currentPassword: TEST_PASSWORD }),
            409,
            "LAST_ADMIN"
        );
        expect((await User.findById(admin._id).lean()).status).toBe("active");
    });
});

describe("POST /auth/accept-invite", () => {
    async function inviteToken(app, emailService, role = "trainer") {
        const admin = await createUser({ role: "admin" });
        const ctx = {
            ...makeAuthCtx(),
            mail: (message) => emailService.enqueueEmail(message),
        };
        await createInvite(
            { email: "invited.person@example.test", role },
            {
                userId: String(admin._id),
                role: admin.role,
                orgId: String(admin.orgId),
            },
            ctx
        );
        await emailService.whenSettled();
        return tokenOf(
            emailService.outbox.latest({
                to: "invited.person@example.test",
                templateKey: "invite",
            })
        );
    }

    it("creates the invited user with the invited role and starts a session", async () => {
        const { app, emailService } = buildAuthApp();
        const token = await inviteToken(app, emailService, "trainer");
        const agent = await createAuthAgent(app);
        const response = await agent.post(`${API}/accept-invite`).send({
            token,
            name: "Invited Person",
            password: "Sturdy-Meadow-Lantern-Quartz-55",
        });
        const body = expectSuccess(response);
        expect(body.data.user).toMatchObject({
            email: "invited.person@example.test",
            role: "trainer",
            status: "active",
        });
        expect(agent.cookie("sai_access")).toBeTruthy();
        expectError(
            await agent.post(`${API}/accept-invite`).send({
                token,
                name: "Again",
                password: "Sturdy-Meadow-Lantern-Quartz-55",
            }),
            400,
            "INVITE_INVALID"
        );
    });

    it("cannot be used to pick a role: the body is strict", async () => {
        const { app, emailService } = buildAuthApp();
        const token = await inviteToken(app, emailService, "trainer");
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/accept-invite`).send({
                token,
                name: "N",
                password: "Sturdy-Meadow-Lantern-Quartz-55",
                role: "superadmin",
            }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("answers INVITE_INVALID, PASSWORD_POLICY and VALIDATION_ERROR; no GET", async () => {
        const { app, emailService } = buildAuthApp();
        const token = await inviteToken(app, emailService);
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/accept-invite`).send({
                token: "i".repeat(43),
                name: "N",
                password: "Sturdy-Meadow-Lantern-Quartz-55",
            }),
            400,
            "INVITE_INVALID"
        );
        expectError(
            await agent
                .post(`${API}/accept-invite`)
                .send({ token, name: "N", password: "short" }),
            400,
            "PASSWORD_POLICY"
        );
        expectError(
            await agent.post(`${API}/accept-invite`).send({ token, name: "N" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(await agent.get(`${API}/accept-invite`), 404, "NOT_FOUND");
    });
});
