import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { buildAuthApp } from "#tests/helpers/authApp.js";
import { createAuthAgent } from "#tests/helpers/authAgent.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken } from "#tests/helpers/outbox.js";

const EMAIL = "lifecycle.learner@example.test";
const PASSWORD = "Correct-Horse-Battery-Staple-42";
const NEW_PASSWORD = "Another-Long-Passphrase-Value-77";
const API = "/api/v1/auth";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

describe("auth lifecycle (doc 20 section 15, TEST-38)", () => {
    it("register -> verify -> login -> me -> refresh -> logout -> forgot -> reset -> login", async () => {
        const { app, emailService } = buildAuthApp();
        const browser = await createAuthAgent(app);

        // register: neutral 202, the verification mail is queued after the response
        const registered = await browser
            .post(`${API}/register`)
            .send({
                name: "Ana Learner",
                email: EMAIL,
                password: PASSWORD,
                acceptTerms: true,
            });
        expectSuccess(registered, 202);
        await emailService.whenSettled();
        const verifyToken = latestToken(emailService, EMAIL, "verify-email");
        expect(verifyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

        // login before verifying is refused only AFTER the password is right
        expectError(
            await browser
                .post(`${API}/login`)
                .send({ email: EMAIL, password: PASSWORD }),
            403,
            "EMAIL_NOT_VERIFIED"
        );

        // verify: activates and starts a session (no token in the body)
        const verified = await browser
            .post(`${API}/verify-email`)
            .send({ token: verifyToken });
        const verifiedBody = expectSuccess(verified);
        expect(verifiedBody.data.user).toMatchObject({
            email: EMAIL,
            status: "active",
            role: "learner",
            emailVerified: true,
        });
        expect(JSON.stringify(verifiedBody)).not.toMatch(
            /accessToken|refreshToken|sai_/
        );
        expect(browser.cookie("sai_access")).toBeTruthy();

        // me
        const me = expectSuccess(await browser.get(`${API}/me`));
        expect(me.data.user.email).toBe(EMAIL);

        // refresh rotates the refresh token
        const before = browser.cookie("sai_refresh", API);
        expectSuccess(await browser.post(`${API}/refresh`));
        expect(browser.cookie("sai_refresh", API)).not.toBe(before);

        // logout clears the session
        expectSuccess(await browser.post(`${API}/logout`));
        expectError(await browser.get(`${API}/me`), 401, "AUTH_REQUIRED");
        await browser.prime();

        // forgot -> outbox token -> reset
        expectSuccess(
            await browser.post(`${API}/forgot-password`).send({ email: EMAIL })
        );
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const resetToken = latestToken(emailService, EMAIL, "password-reset");
        expectSuccess(
            await browser
                .post(`${API}/reset-password/validate`)
                .send({ token: resetToken })
        );
        const reset = await browser
            .post(`${API}/reset-password`)
            .send({ token: resetToken, newPassword: NEW_PASSWORD });
        expectSuccess(reset);
        expect(browser.cookie("sai_access")).toBeUndefined();

        // old password dead, new one works
        expectError(
            await browser
                .post(`${API}/login`)
                .send({ email: EMAIL, password: PASSWORD }),
            401,
            "INVALID_CREDENTIALS"
        );
        const login = await browser
            .post(`${API}/login`)
            .send({ email: EMAIL, password: NEW_PASSWORD, rememberMe: true });
        expect(expectSuccess(login).data).toMatchObject({
            needsOnboarding: false,
            reactivate: false,
        });
        expectSuccess(await browser.get(`${API}/me`));
    });
});
