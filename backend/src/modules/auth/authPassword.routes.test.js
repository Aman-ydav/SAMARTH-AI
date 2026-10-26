// supertest route tests (TEST-08) for forgot, validate, reset and change password.
import jwt from "jsonwebtoken";
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
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { User } from "#modules/users/user.model.js";
import { RefreshSession } from "./refreshSession.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const NEW_PASSWORD = "Fresh-Unrelated-Passphrase-9";

async function requestResetToken(app, emailService, email) {
    const agent = await createAuthAgent(app);
    await agent.post(`${API}/forgot-password`).send({ email });
    await whenBackgroundIdle();
    await emailService.whenSettled();
    return latestToken(emailService, email, "password-reset");
}

describe("POST /auth/forgot-password", () => {
    it("answers 200 with an identical body for active, unknown, Google-only, unverified and suspended addresses", async () => {
        const { app } = buildAuthApp();
        const emails = [
            (await createUser()).email,
            "nobody@example.test",
            (
                await createUser({
                    passwordHash: null,
                    googleSub: "g-1",
                    authProviders: ["google"],
                })
            ).email,
            (
                await createUser({
                    status: "pending_verification",
                    emailVerified: false,
                })
            ).email,
            (await createUser({ status: "suspended" })).email,
        ];
        const bodies = [];
        for (const email of emails) {
            const agent = await createAuthAgent(app);
            const response = await agent
                .post(`${API}/forgot-password`)
                .send({ email });
            bodies.push({ ...expectSuccess(response), requestId: undefined });
        }
        await whenBackgroundIdle();
        for (const body of bodies) expect(body).toEqual(bodies[0]);
    });

    it("mails only the accounts that may reset, with a fragment link", async () => {
        const { app, emailService } = buildAuthApp();
        const active = await createUser();
        const suspended = await createUser({ status: "suspended" });
        const agent = await createAuthAgent(app);
        for (const email of [
            active.email,
            suspended.email,
            "nobody@example.test",
        ]) {
            await agent.post(`${API}/forgot-password`).send({ email });
        }
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const mails = emailService.outbox.all();
        expect(mails.map((mail) => mail.to)).toEqual([active.email]);
        expect(mails[0].data.link).toMatch(
            /^http:\/\/localhost:5173\/reset-password#token=[\w-]{43}$/
        );
    });

    it("validates the body and requires CSRF", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/forgot-password`).send({ email: "nope" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent.post(`${API}/forgot-password`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        const response = await agent.agent
            .post(`${API}/forgot-password`)
            .send({ email: "a@example.test" });
        expectError(response, 403, "CSRF_INVALID");
    });
});

describe("POST /auth/reset-password/validate and /auth/reset-password", () => {
    it("validate answers { valid: true } without consuming; reset consumes once and does not log in", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const token = await requestResetToken(app, emailService, user.email);
        const agent = await createAuthAgent(app);
        expect(
            expectSuccess(
                await agent
                    .post(`${API}/reset-password/validate`)
                    .send({ token })
            ).data
        ).toEqual({ valid: true });
        expect(
            expectSuccess(
                await agent
                    .post(`${API}/reset-password/validate`)
                    .send({ token })
            ).data
        ).toEqual({ valid: true });

        const response = await agent
            .post(`${API}/reset-password`)
            .send({ token, newPassword: NEW_PASSWORD });
        expectSuccess(response);
        expect(response.headers["set-cookie"]?.join(";") ?? "").not.toMatch(
            /sai_access|sai_refresh/
        );
        expectError(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: NEW_PASSWORD }),
            400,
            "RESET_TOKEN_INVALID"
        );
        expectError(
            await agent.post(`${API}/reset-password/validate`).send({ token }),
            400,
            "RESET_TOKEN_INVALID"
        );
    });

    it("answers RESET_TOKEN_INVALID for unknown and malformed tokens on both routes", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        for (const token of ["z".repeat(43), "x", "../etc/passwd"]) {
            expectError(
                await agent
                    .post(`${API}/reset-password/validate`)
                    .send({ token }),
                400,
                "RESET_TOKEN_INVALID"
            );
            expectError(
                await agent
                    .post(`${API}/reset-password`)
                    .send({ token, newPassword: NEW_PASSWORD }),
                400,
                "RESET_TOKEN_INVALID"
            );
        }
    });

    it("expires after 30 minutes (fake clock)", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const token = await requestResetToken(app, emailService, user.email);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31 * 60_000);
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: NEW_PASSWORD }),
            400,
            "RESET_TOKEN_INVALID"
        );
    });

    it("answers PASSWORD_POLICY and PASSWORD_REUSED without consuming the token", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const token = await requestResetToken(app, emailService, user.email);
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: "short" }),
            400,
            "PASSWORD_POLICY"
        );
        expectError(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: TEST_PASSWORD }),
            400,
            "PASSWORD_REUSED"
        );
        expectSuccess(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: NEW_PASSWORD })
        );
    });

    it("revokes all sessions, kills the old password and lets the new one sign in", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const session = await loginAs(app, user.email);
        const token = await requestResetToken(app, emailService, user.email);
        const agent = await createAuthAgent(app);
        expectSuccess(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: NEW_PASSWORD })
        );

        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        await session.agent.prime();
        expectError(await session.agent.get(`${API}/me`), 401, "TOKEN_INVALID");
        expectError(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: TEST_PASSWORD }),
            401,
            "INVALID_CREDENTIALS"
        );
        expectSuccess(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: NEW_PASSWORD })
        );
        await emailService.whenSettled();
        expect(
            emailService.outbox.find({
                to: user.email,
                templateKey: "password-changed",
            })
        ).toHaveLength(1);
    });

    it("validates bodies, refuses extra fields and GET", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/reset-password`).send({ token: "x" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/reset-password`)
                .send({
                    token: "x",
                    newPassword: "y",
                    email: "a@example.test",
                }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent.post(`${API}/reset-password/validate`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent.get(`${API}/reset-password/validate`),
            404,
            "NOT_FOUND"
        );
        expectError(await agent.get(`${API}/reset-password`), 404, "NOT_FOUND");
    });
});

describe("POST /auth/change-password", () => {
    it("changes the password, keeps this session working with fresh cookies and signs other sessions out", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const mine = await loginAs(app, user.email);
        const other = await loginAs(app, user.email);
        const before = mine.agent.cookie("sai_access");
        const response = await mine.agent
            .post(`${API}/change-password`)
            .send({
                currentPassword: TEST_PASSWORD,
                newPassword: NEW_PASSWORD,
            });
        const body = expectSuccess(response);
        expect(body.data.user.hasPassword).toBe(true);
        expect(mine.agent.cookie("sai_access")).not.toBe(before);
        expect(jwt.decode(mine.agent.cookie("sai_access")).tv).toBe(1);
        expectSuccess(await mine.agent.get(`${API}/me`));
        await other.agent.prime();
        expect([401]).toContain((await other.agent.get(`${API}/me`)).status);
        const fresh = await createAuthAgent(app);
        expectSuccess(
            await fresh
                .post(`${API}/login`)
                .send({ email: user.email, password: NEW_PASSWORD })
        );
    });

    it("answers 401 without a session, INVALID_CREDENTIALS for a wrong current password and REAUTH_REQUIRED for a Google-only account", async () => {
        const { app } = buildAuthApp();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous
                .post(`${API}/change-password`)
                .send({ currentPassword: "x", newPassword: "y" }),
            401,
            "AUTH_REQUIRED"
        );

        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({
                    currentPassword: "Wrong-Password-Value-1",
                    newPassword: NEW_PASSWORD,
                }),
            401,
            "INVALID_CREDENTIALS"
        );
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({ currentPassword: TEST_PASSWORD, newPassword: "short" }),
            400,
            "PASSWORD_POLICY"
        );
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: TEST_PASSWORD,
                }),
            400,
            "PASSWORD_REUSED"
        );

        const verify = vi
            .fn()
            .mockResolvedValue({
                sub: "g-9",
                email: "g@example.test",
                name: "G",
            });
        const google = buildAuthApp({ verifyGoogleCredential: verify });
        const gUser = await createUser({
            passwordHash: null,
            googleSub: "g-9",
            authProviders: ["google"],
        });
        const session = await createAuthAgent(google.app);
        await session
            .post(`${API}/google`)
            .send({ credential: "google-credential-value" });
        expectError(
            await session
                .post(`${API}/change-password`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: NEW_PASSWORD,
                }),
            403,
            "REAUTH_REQUIRED"
        );
        expectSuccess(
            await session
                .post(`${API}/change-password`)
                .send({
                    credential: "google-credential-value",
                    newPassword: NEW_PASSWORD,
                })
        );
        expect(gUser).toBeTruthy();
    });

    it("needs exactly one proof and refuses unknown fields", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({ newPassword: NEW_PASSWORD }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({
                    currentPassword: "a",
                    credential: "b".repeat(20),
                    newPassword: NEW_PASSWORD,
                }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/change-password`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: NEW_PASSWORD,
                    role: "admin",
                }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("is the only route a must-change-password session may call (AUTH-38)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser({ mustChangePassword: true });
        const { agent, response } = await loginAs(app, user.email);
        const body = expectSuccess(response);
        expect(body.data.user.mustChangePassword).toBe(true);
        expect(agent.cookie("sai_access")).toBeTruthy();
        expect(agent.cookie("sai_refresh", API)).toBeUndefined();
        expectError(await agent.get(`${API}/me`), 403, "MUST_CHANGE_PASSWORD");
        expectError(
            await agent.post(`${API}/logout-all`),
            403,
            "MUST_CHANGE_PASSWORD"
        );

        const changed = await agent
            .post(`${API}/change-password`)
            .send({
                currentPassword: TEST_PASSWORD,
                newPassword: NEW_PASSWORD,
            });
        expectSuccess(changed);
        expect(agent.cookie("sai_refresh", API)).toBeTruthy();
        expect(await User.findById(user._id).lean()).toMatchObject({
            mustChangePassword: false,
        });
        expect(
            expectSuccess(await agent.get(`${API}/me`)).data.user
                .mustChangePassword
        ).toBe(false);
    });
});
