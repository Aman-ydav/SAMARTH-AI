import bcrypt from "bcryptjs";
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
import { createEmailService } from "#services/email.service.js";
import { createLogger } from "#utils/logger.js";
import { whenBackgroundIdle } from "#utils/backgroundTasks.js";
import { User } from "#modules/users/user.model.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent, rawRequest } from "#tests/helpers/authAgent.js";
import {
    buildAuthApp,
    loginAs,
    registerAndVerify,
} from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { latestToken } from "#tests/helpers/outbox.js";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { cookiesOf } from "#tests/helpers/setCookie.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";
const NEW_PASSWORD = "Fresh-Unrelated-Passphrase-9";
const strip = (body) => ({ ...body, requestId: undefined });

describe("anti-enumeration (AUTH-34, EDGE-70)", () => {
    it("login runs exactly one bcrypt compare for a known account, an unknown one and a Google-only one", async () => {
        const { app } = buildAuthApp();
        const known = await createUser();
        const googleOnly = await createUser({
            passwordHash: null,
            googleSub: "g-1",
            authProviders: ["google"],
        });
        const compare = vi.spyOn(bcrypt, "compare");
        for (const email of [
            known.email,
            "ghost@example.test",
            googleOnly.email,
        ]) {
            compare.mockClear();
            const agent = await createAuthAgent(app);
            expectError(
                await agent
                    .post(`${API}/login`)
                    .send({ email, password: "Wrong-Password-Value-1" }),
                401,
                "INVALID_CREDENTIALS"
            );
            expect(compare, email).toHaveBeenCalledTimes(1);
        }
    });

    it("register, resend and forgot take the same time class: one hash for register in every branch, no bcrypt for the others", async () => {
        const { app } = buildAuthApp();
        const owner = await createUser();
        const hash = vi.spyOn(bcrypt, "hash");
        const compare = vi.spyOn(bcrypt, "compare");
        const agent = await createAuthAgent(app);
        for (const email of [owner.email, "new.person@example.test"]) {
            hash.mockClear();
            await agent
                .post(`${API}/register`)
                .send({
                    name: "Ana Person",
                    email,
                    password: TEST_PASSWORD,
                    acceptTerms: true,
                });
            expect(hash).toHaveBeenCalledTimes(1);
        }
        hash.mockClear();
        for (const email of [owner.email, "ghost@example.test"]) {
            await agent.post(`${API}/forgot-password`).send({ email });
            await agent.post(`${API}/resend-verification`).send({ email });
        }
        await whenBackgroundIdle();
        expect(hash).not.toHaveBeenCalled();
        expect(compare).not.toHaveBeenCalled();
    });

    it("a locked real account and a locked unknown email answer identically", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { app } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "5" },
        });
        const real = await createUser();
        for (const email of [real.email, "ghost.account@example.test"]) {
            for (let i = 0; i < 5; i += 1) {
                const agent = await createAuthAgent(app);
                await agent
                    .post(`${API}/login`)
                    .send({ email, password: "Wrong-Password-Value-1" });
            }
        }
        const answers = [];
        for (const email of [real.email, "ghost.account@example.test"]) {
            const agent = await createAuthAgent(app);
            const response = await agent
                .post(`${API}/login`)
                .send({ email, password: TEST_PASSWORD });
            answers.push(strip(expectError(response, 423, "ACCOUNT_LOCKED")));
        }
        expect(answers[0]).toEqual(answers[1]);
        expect(answers[0].retryAfterSec).toBe(900);
    });
});

describe("lockout over HTTP (AUTH-36)", () => {
    it("locks after 5 failures, unlocks when the time has passed, then the counters start again", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        const { app, emailService } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "5" },
        });
        const user = await createUser();
        for (let i = 0; i < 5; i += 1) {
            const agent = await createAuthAgent(app);
            expectError(
                await agent
                    .post(`${API}/login`)
                    .send({
                        email: user.email,
                        password: "Wrong-Password-Value-1",
                    }),
                401,
                "INVALID_CREDENTIALS"
            );
        }
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: TEST_PASSWORD }),
            423,
            "ACCOUNT_LOCKED"
        );
        await emailService.whenSettled();
        expect(
            emailService.outbox.find({
                to: user.email,
                templateKey: "account-locked",
            })
        ).toHaveLength(1);

        vi.setSystemTime(new Date("2026-10-26T10:15:01Z"));
        const unlocked = await createAuthAgent(app);
        expectSuccess(
            await unlocked
                .post(`${API}/login`)
                .send({ email: user.email, password: TEST_PASSWORD })
        );
        expect(await User.findById(user._id).lean()).toMatchObject({
            failedLoginCount: 0,
            lockUntil: null,
        });
    });

    it("a locked account can still reset its password, which clears the lock (AUTH-53)", async () => {
        const { app, emailService } = buildAuthApp({
            env: { RATE_LIMIT_IP_MULTIPLIER: "5" },
        });
        const user = await createUser();
        for (let i = 0; i < 5; i += 1) {
            const agent = await createAuthAgent(app);
            await agent
                .post(`${API}/login`)
                .send({
                    email: user.email,
                    password: "Wrong-Password-Value-1",
                });
        }
        const agent = await createAuthAgent(app);
        expectError(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: TEST_PASSWORD }),
            423,
            "ACCOUNT_LOCKED"
        );
        await agent.post(`${API}/forgot-password`).send({ email: user.email });
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const token = latestToken(emailService, user.email, "password-reset");
        expectSuccess(
            await agent
                .post(`${API}/reset-password`)
                .send({ token, newPassword: NEW_PASSWORD })
        );
        expectSuccess(
            await agent
                .post(`${API}/login`)
                .send({ email: user.email, password: NEW_PASSWORD })
        );
    });
});

describe("links in email (AUTH-31, R2)", () => {
    it("are built from FRONTEND_URL only, even with forged Host and X-Forwarded-Host headers, and carry tokens in the fragment", async () => {
        const { app, emailService } = buildAuthApp({
            env: { FRONTEND_URL: "http://localhost:5173" },
        });
        const user = await createUser();
        const forged = {
            Host: "evil.example.test",
            "X-Forwarded-Host": "evil2.example.test",
            "X-Forwarded-Proto": "https",
        };
        const agent = await createAuthAgent(app, { headers: forged });
        await agent
            .post(`${API}/register`)
            .send({
                name: "Ana Person",
                email: "forged.host@example.test",
                password: TEST_PASSWORD,
                acceptTerms: true,
            });
        await agent
            .post(`${API}/register`)
            .send({
                name: "Ana Person",
                email: user.email,
                password: TEST_PASSWORD,
                acceptTerms: true,
            });
        await agent.post(`${API}/forgot-password`).send({ email: user.email });
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const mails = emailService.outbox.all();
        expect(mails.map((mail) => mail.templateKey).sort()).toEqual([
            "already-registered",
            "password-reset",
            "verify-email",
        ]);
        for (const mail of mails) {
            const urls = [
                ...JSON.stringify(mail).matchAll(/https?:\/\/[^"\\\s<>)]+/g),
            ].map((match) => match[0]);
            expect(urls.length).toBeGreaterThan(0);
            for (const url of urls) {
                expect(url, url).toMatch(/^http:\/\/localhost:5173\//);
                expect(url).not.toMatch(/evil/);
                expect(url).not.toMatch(/[?&]token=/);
            }
        }
        const withToken = mails.filter(
            (mail) => mail.templateKey !== "already-registered"
        );
        for (const mail of withToken)
            expect(mail.data.link).toMatch(/#token=[A-Za-z0-9_-]{43}$/);
    });
});

describe("logs hold no secrets (AUTH-24, BE-81)", () => {
    it("a full register, verify, login, refresh, forgot, reset, logout run logs no password, token, cookie value or email", async () => {
        const lines = [];
        const log = createLogger({
            level: "debug",
            isDevelopment: false,
            destination: { write: (line) => lines.push(line) },
        });
        const { app, emailService } = buildAuthApp({ log });
        const email = "log.check.person@example.test";
        const { agent } = await registerAndVerify(app, emailService, {
            email,
            password: TEST_PASSWORD,
        });
        const verifyToken = latestToken(emailService, email, "verify-email");
        const access = agent.cookie("sai_access");
        const refresh = agent.cookie("sai_refresh", API);
        const csrf = agent.csrf;
        await agent.post(`${API}/refresh`);
        await agent.post(`${API}/logout`);
        await agent.prime();
        await agent
            .post(`${API}/login`)
            .send({ email, password: "Wrong-Password-Value-1" });
        await agent.post(`${API}/forgot-password`).send({ email });
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const resetToken = latestToken(emailService, email, "password-reset");
        await agent
            .post(`${API}/reset-password`)
            .send({ token: resetToken, newPassword: NEW_PASSWORD });
        await agent
            .post(`${API}/verify-email`)
            .send({ token: "not-the-real-token-value" });

        const output = lines.join("");
        expect(output.length).toBeGreaterThan(0);
        for (const secret of [
            TEST_PASSWORD,
            NEW_PASSWORD,
            "Wrong-Password-Value-1",
            verifyToken,
            resetToken,
            access,
            refresh,
            csrf,
            "not-the-real-token-value",
            email,
            "log.check",
        ]) {
            expect(output, String(secret).slice(0, 12)).not.toContain(secret);
        }
        expect(output).not.toMatch(/\$2[aby]\$/);
    });
});

describe("hostile input", () => {
    it("rejects NoSQL operators in credentials and nested objects, and strips prototype keys", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        for (const body of [
            { email: { $gt: "" }, password: { $gt: "" } },
            { email: { $ne: null }, password: "x" },
            { email: user.email, password: { $regex: ".*" } },
            { email: [user.email], password: "x" },
        ]) {
            expectError(
                await agent.post(`${API}/login`).send(body),
                400,
                "VALIDATION_ERROR"
            );
        }
        const polluted = await agent
            .post(`${API}/login`)
            .set("Content-Type", "application/json")
            .send(
                '{"__proto__":{"role":"admin"},"email":"x@example.test","password":"x"}'
            );
        expect([400, 401]).toContain(polluted.status);
        expect({}.role).toBeUndefined();
    });

    it("answers 413 PAYLOAD_TOO_LARGE for an oversized body", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/login`)
            .send({ email: "a@example.test", password: "x".repeat(200_000) });
        expectError(response, 413, "PAYLOAD_TOO_LARGE");
    });

    it("never redirects: a returnTo in the query changes nothing and there is no Location header (AUTH-57)", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        for (const returnTo of [
            "//evil.test",
            "https://evil.test",
            "\\\\evil.test",
            "/ok%0d%0aSet-Cookie:x=1",
        ]) {
            const response = await agent.get(
                `${API}/me?returnTo=${encodeURIComponent(returnTo)}`
            );
            expect(response.headers.location).toBeUndefined();
            expect([400, 401]).toContain(response.status);
        }
    });
});

describe("races (BE-44, EDGE-33)", () => {
    it("five simultaneous registrations of one address leave one user and five identical 202 answers", async () => {
        const { app } = buildAuthApp();
        const responses = await Promise.all(
            Array.from({ length: 5 }, async () => {
                const agent = await createAuthAgent(app);
                return agent
                    .post(`${API}/register`)
                    .send({
                        name: "Race Person",
                        email: "race@example.test",
                        password: TEST_PASSWORD,
                        acceptTerms: true,
                    });
            })
        );
        expect(responses.map((response) => response.status)).toEqual([
            202, 202, 202, 202, 202,
        ]);
        expect(await User.countDocuments({ email: "race@example.test" })).toBe(
            1
        );
    });

    it("two simultaneous resets with one token: one 200, one RESET_TOKEN_INVALID", async () => {
        const { app, emailService } = buildAuthApp();
        const user = await createUser();
        const agent = await createAuthAgent(app);
        await agent.post(`${API}/forgot-password`).send({ email: user.email });
        await whenBackgroundIdle();
        await emailService.whenSettled();
        const token = latestToken(emailService, user.email, "password-reset");
        const attempts = await Promise.all(
            [NEW_PASSWORD, "Second-Distinct-Passphrase-4"].map(
                async (newPassword) => {
                    const racer = await createAuthAgent(app);
                    return racer
                        .post(`${API}/reset-password`)
                        .send({ token, newPassword });
                }
            )
        );
        expect(attempts.map((response) => response.status).sort()).toEqual([
            200, 400,
        ]);
        expect(
            attempts.find((response) => response.status === 400).body.code
        ).toBe("RESET_TOKEN_INVALID");
    });

    it("two simultaneous verifications with one token: one session is created", async () => {
        const { app, emailService } = buildAuthApp();
        const agent = await createAuthAgent(app);
        await agent
            .post(`${API}/register`)
            .send({
                name: "Ver Person",
                email: "ver@example.test",
                password: TEST_PASSWORD,
                acceptTerms: true,
            });
        await emailService.whenSettled();
        const token = latestToken(
            emailService,
            "ver@example.test",
            "verify-email"
        );
        const attempts = await Promise.all(
            [1, 2].map(async () =>
                (await createAuthAgent(app))
                    .post(`${API}/verify-email`)
                    .send({ token })
            )
        );
        expect(attempts.map((response) => response.status).sort()).toEqual([
            200, 400,
        ]);
        expect(
            attempts.filter((response) => cookiesOf(response).sai_refresh)
        ).toHaveLength(1);
    });
});

describe("third-party failure (EDGE-51, BE-72)", () => {
    it("a failing mail transport never changes the answer and the failure is recorded without the address", async () => {
        const config = makeTestEnv();
        const failing = {
            name: "memory",
            send: vi.fn(async () => {
                throw new Error("transport down");
            }),
        };
        const emailService = createEmailService({
            config,
            transport: failing,
            retryDelaysMs: [],
        });
        const { app } = buildAuthApp({ emailService });
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/register`)
            .send({
                name: "Mail Person",
                email: "mail.fail@example.test",
                password: TEST_PASSWORD,
                acceptTerms: true,
            });
        expectSuccess(response, 202);
        await emailService.whenSettled();
        const [failure] = emailService.getFailures();
        expect(failure).toMatchObject({ templateKey: "verify-email" });
        expect(JSON.stringify(failure)).not.toContain("mail.fail");
        expect(
            await User.countDocuments({ email: "mail.fail@example.test" })
        ).toBe(1);
    });
});

describe("account state changes take effect on the next request (EDGE-23)", () => {
    it.each([
        ["suspended", 403, "ACCOUNT_SUSPENDED"],
        ["deactivated", 403, "ACCOUNT_DEACTIVATED"],
        ["pending_deletion", 401, "SESSION_REVOKED"],
    ])(
        "a signed-in user who becomes %s gets %i %s",
        async (status, statusCode, code) => {
            const { app } = buildAuthApp();
            const user = await createUser();
            const { agent } = await loginAs(app, user.email);
            await User.updateOne({ _id: user._id }, { status });
            expectError(await agent.get(`${API}/me`), statusCode, code);
        }
    );

    it("the raw refresh cookie of a removed user is refused too", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const refresh = agent.cookie("sai_refresh", API);
        await User.updateOne({ _id: user._id }, { status: "suspended" });
        expectError(
            await rawRequest(app, "post", `${API}/refresh`, {
                cookies: { sai_refresh: refresh },
            }),
            401,
            "REFRESH_INVALID"
        );
    });
});
