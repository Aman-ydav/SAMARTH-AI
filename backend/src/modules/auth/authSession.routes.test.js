// supertest route tests (TEST-08) for register, verify-email, resend-verification and login.
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
import { createAuthAgent, rawRequest } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { issueEmailToken } from "./tokens.service.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const signup = (overrides = {}) => ({
    name: "Ana Learner",
    email: "ana.route@example.test",
    password: TEST_PASSWORD,
    acceptTerms: true,
    ...overrides,
});

describe("POST /auth/register", () => {
    it("answers 202 with one neutral message for a new, a pending and an existing address", async () => {
        const { app } = buildAuthApp();
        const owner = await createUser({ email: "taken@example.test" });
        const agent = await createAuthAgent(app);
        const bodies = [];
        for (const email of [
            "fresh@example.test",
            "fresh@example.test",
            owner.email,
        ]) {
            const response = await agent
                .post(`${API}/register`)
                .send(signup({ email }));
            const body = expectSuccess(response, 202);
            bodies.push({ ...body, requestId: undefined });
            expect(response.headers["set-cookie"]?.join(";") ?? "").not.toMatch(
                /sai_access|sai_refresh/
            );
        }
        expect(bodies[0]).toEqual(bodies[1]);
        expect(bodies[0]).toEqual(bodies[2]);
        expect(bodies[0].data).toBeNull();
    });

    it("sends the verification mail after the response with the token in the URL fragment", async () => {
        const { app, emailService } = buildAuthApp();
        const agent = await createAuthAgent(app);
        await agent.post(`${API}/register`).send(signup());
        await emailService.whenSettled();
        const mail = emailService.outbox.latest({
            to: "ana.route@example.test",
            templateKey: "verify-email",
        });
        expect(mail.data.link).toMatch(
            /^http:\/\/localhost:5173\/verify-email#token=[\w-]{43}$/
        );
        expect(mail.data.link).not.toContain("?");
    });

    it.each([
        ["no body", {}],
        ["missing name", { name: undefined }],
        ["blank name", { name: "   " }],
        ["bad email", { email: "not-an-email" }],
        ["missing password", { password: undefined }],
        ["terms not accepted", { acceptTerms: false }],
        ["terms missing", { acceptTerms: undefined }],
        ["terms as a string", { acceptTerms: "true" }],
        ["control characters in the name", { name: "Ana\u0000" }],
    ])(
        "rejects %s with 400 VALIDATION_ERROR and field entries",
        async (_label, patch) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const body = _label === "no body" ? {} : signup(patch);
            const response = await agent.post(`${API}/register`).send(body);
            const error = expectError(response, 400, "VALIDATION_ERROR");
            expect(error.errors.length).toBeGreaterThan(0);
            expect(
                error.errors.every((entry) => typeof entry.field === "string")
            ).toBe(true);
        }
    );

    it.each([
        ["role", "superadmin"],
        ["status", "active"],
        ["orgId", "x"],
        ["emailVerified", true],
    ])(
        "refuses the protected field %s in the body (mass assignment)",
        async (field, value) => {
            const { app } = buildAuthApp();
            const agent = await createAuthAgent(app);
            const response = await agent
                .post(`${API}/register`)
                .send({ ...signup(), [field]: value });
            const error = expectError(response, 400, "VALIDATION_ERROR");
            expect(error.errors).toEqual([
                expect.objectContaining({ field, message: "Unknown field" }),
            ]);
        }
    );

    it("answers PASSWORD_POLICY (not VALIDATION_ERROR) for a weak password", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/register`)
            .send(signup({ password: "password123" }));
        expectError(response, 400, "PASSWORD_POLICY");
    });

    it("answers DOMAIN_NOT_ALLOWED explicitly for a disallowed domain", async () => {
        const { app } = buildAuthApp({
            env: { ALLOWED_EMAIL_DOMAINS: "gov.in" },
        });
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/register`).send(signup()),
            403,
            "DOMAIN_NOT_ALLOWED"
        );
    });

    it("requires the CSRF header", async () => {
        const { app } = buildAuthApp();
        const response = await rawRequest(app, "post", `${API}/register`, {
            body: signup(),
            headers: { "X-CSRF-Token": "wrong".repeat(10) },
        });
        expectError(response, 403, "CSRF_INVALID");
    });
});

describe("POST /auth/verify-email", () => {
    it("activates the account, starts a session and returns the user without tokens", async () => {
        const { app, emailService } = buildAuthApp();
        const agent = await createAuthAgent(app);
        await agent.post(`${API}/register`).send(signup());
        await emailService.whenSettled();
        const token = latestToken(
            emailService,
            "ana.route@example.test",
            "verify-email"
        );
        const response = await agent
            .post(`${API}/verify-email`)
            .send({ token });
        const body = expectSuccess(response);
        expect(body.data).toMatchObject({
            user: { status: "active", emailVerified: true },
            needsOnboarding: false,
        });
        expect(agent.cookie("sai_access")).toBeTruthy();
        expect(JSON.stringify(body)).not.toContain(token);
    });

    it("answers VERIFY_TOKEN_INVALID for unknown, reused and malformed tokens alike", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        for (const token of ["u".repeat(43), "short", "<script>"]) {
            expectError(
                await agent.post(`${API}/verify-email`).send({ token }),
                400,
                "VERIFY_TOKEN_INVALID"
            );
        }
    });

    it("rejects a missing token and extra fields with 400 VALIDATION_ERROR", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/verify-email`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/verify-email`)
                .send({ token: "x", returnTo: "/admin" }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("never consumes on GET: the API has no GET for it (R34)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        const { token } = await issueEmailToken({
            type: "emailVerify",
            userId: user._id,
            email: user.email,
        });
        const agent = await createAuthAgent(app);
        expectError(
            await agent.get(`${API}/verify-email?token=${token}`),
            404,
            "NOT_FOUND"
        );
        const { AuthToken } = await import("./authToken.model.js");
        expect(
            (await AuthToken.findOne({ userId: user._id }).lean()).usedAt
        ).toBeNull();
    });
});

describe("POST /auth/resend-verification", () => {
    it("answers 200 with the same message for a pending, an active and an unknown address", async () => {
        const { app } = buildAuthApp();
        const pending = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        const active = await createUser();
        const agent = await createAuthAgent(app);
        const bodies = [];
        for (const email of [
            pending.email,
            active.email,
            "ghost@example.test",
        ]) {
            const response = await agent
                .post(`${API}/resend-verification`)
                .send({ email });
            bodies.push({ ...expectSuccess(response), requestId: undefined });
        }
        await whenBackgroundIdle();
        expect(bodies[0]).toEqual(bodies[1]);
        expect(bodies[0]).toEqual(bodies[2]);
    });

    it("mails a link only to the pending address (after the response)", async () => {
        const { app, emailService } = buildAuthApp();
        const pending = await createUser({
            status: "pending_verification",
            emailVerified: false,
        });
        const active = await createUser();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/resend-verification`)
            .send({ email: pending.email });
        await agent
            .post(`${API}/resend-verification`)
            .send({ email: active.email });
        await whenBackgroundIdle();
        await emailService.whenSettled();
        expect(emailService.outbox.all().map((mail) => mail.to)).toEqual([
            pending.email,
        ]);
    });

    it("validates the body", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post(`${API}/resend-verification`)
                .send({ email: "nope" }),
            400,
            "VALIDATION_ERROR"
        );
    });
});

describe("POST /auth/login", () => {
    it("signs in: 200, user summary, needsOnboarding, no token anywhere in the body", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { response, agent } = await loginAs(app, user.email);
        const body = expectSuccess(response);
        expect(body.data).toMatchObject({
            user: {
                id: String(user._id),
                email: user.email,
                role: "learner",
                hasPassword: true,
                mustChangePassword: false,
            },
            needsOnboarding: false,
            reactivate: false,
        });
        expect(JSON.stringify(body)).not.toMatch(/token|jwt|sai_/i);
        expect(agent.cookie("sai_access")).toBeTruthy();
        expect(agent.cookie("sai_refresh", API)).toBeTruthy();
    });

    it("answers INVALID_CREDENTIALS with an identical body for a wrong password, an unknown email and a Google-only account", async () => {
        const { app } = buildAuthApp();
        const real = await createUser();
        const googleOnly = await createUser({
            passwordHash: null,
            googleSub: "g-1",
            authProviders: ["google"],
        });
        const bodies = [];
        for (const [email, password] of [
            [real.email, "Wrong-Password-Value-1"],
            ["ghost@example.test", TEST_PASSWORD],
            [googleOnly.email, TEST_PASSWORD],
        ]) {
            const agent = await createAuthAgent(app);
            const response = await agent
                .post(`${API}/login`)
                .send({ email, password });
            bodies.push({
                ...expectError(response, 401, "INVALID_CREDENTIALS"),
                requestId: undefined,
            });
        }
        expect(bodies[0]).toEqual(bodies[1]);
        expect(bodies[0]).toEqual(bodies[2]);
    });

    it.each([
        ["pending_verification", 403, "EMAIL_NOT_VERIFIED"],
        ["suspended", 403, "ACCOUNT_SUSPENDED"],
        ["deactivated", 403, "ACCOUNT_DEACTIVATED"],
    ])(
        "answers %s with %i %s only after the correct password",
        async (status, statusCode, code) => {
            const { app } = buildAuthApp();
            const user = await createUser({ status });
            const agent = await createAuthAgent(app);
            expectError(
                await agent.post(`${API}/login`).send({
                    email: user.email,
                    password: "Wrong-Password-Value-1",
                }),
                401,
                "INVALID_CREDENTIALS"
            );
            expectError(
                await agent
                    .post(`${API}/login`)
                    .send({ email: user.email, password: TEST_PASSWORD }),
                statusCode,
                code
            );
        }
    );

    it("re-submitting with reactivate: true signs a deactivated account in and returns reactivate: true", async () => {
        const { app } = buildAuthApp();
        const user = await createUser({ status: "deactivated" });
        const agent = await createAuthAgent(app);
        const response = await agent.post(`${API}/login`).send({
            email: user.email,
            password: TEST_PASSWORD,
            reactivate: true,
        });
        expect(expectSuccess(response).data.reactivate).toBe(true);
    });

    it("locks after 5 failures with 423, Retry-After and retryAfterSec", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        for (let i = 0; i < 5; i += 1) {
            const agent = await createAuthAgent(app);
            await agent.post(`${API}/login`).send({
                email: user.email,
                password: "Wrong-Password-Value-1",
            });
        }
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/login`)
            .send({ email: user.email, password: TEST_PASSWORD });
        const error = expectError(response, 423, "ACCOUNT_LOCKED");
        expect(error.retryAfterSec).toBeGreaterThan(0);
        expect(Number(response.headers["retry-after"])).toBe(
            error.retryAfterSec
        );
    });

    it.each([
        ["no email", { password: "x" }],
        ["no password", { email: "a@example.test" }],
        ["empty password", { email: "a@example.test", password: "" }],
        [
            "email as an object (NoSQL injection)",
            { email: { $gt: "" }, password: "x" },
        ],
        [
            "password as an object",
            { email: "a@example.test", password: { $ne: "" } },
        ],
        [
            "rememberMe as a string",
            { email: "a@example.test", password: "x", rememberMe: "yes" },
        ],
        [
            "unknown field",
            { email: "a@example.test", password: "x", role: "admin" },
        ],
        [
            "oversized password",
            { email: "a@example.test", password: "x".repeat(300) },
        ],
    ])("rejects %s with 400 VALIDATION_ERROR", async (_label, body) => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/login`).send(body),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("rejects malformed JSON with 400 INVALID_JSON", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/login`)
            .set("Content-Type", "application/json")
            .send("{bad json");
        expectError(response, 400, "INVALID_JSON");
    });

    it("rejects a missing CSRF header with 403 CSRF_INVALID", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        const response = await agent.agent
            .post(`${API}/login`)
            .send({ email: "a@example.test", password: "x" });
        expectError(response, 403, "CSRF_INVALID");
    });
});
