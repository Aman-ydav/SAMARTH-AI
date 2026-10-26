// Cookie-bound session routes over HTTP: Google, logout, logout-all, me and sessions (doc 08 #6, 9-11, 19, 20).
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
import { ApiError } from "#utils/apiError.js";
import { TEST_PASSWORD, createUser } from "#tests/factories/user.factory.js";
import { createAuthAgent, rawRequest } from "#tests/helpers/authAgent.js";
import { buildAuthApp, loginAs } from "#tests/helpers/authApp.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { expectError, expectSuccess } from "#tests/helpers/envelopes.js";
import { RefreshSession } from "#modules/auth/refreshSession.model.js";

vi.mock("bcryptjs", async () =>
    (await import("#tests/helpers/fastBcrypt.js")).fastBcryptMock()
);

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);
afterEach(() => vi.useRealTimers());

const API = "/api/v1/auth";

describe("POST /auth/google", () => {
    const credential = "google-credential-value-123";

    it("signs in with a verified credential and sets the cookies", async () => {
        const verify = vi.fn().mockResolvedValue({
            sub: "g-77",
            email: "gina@example.test",
            name: "Gina G",
        });
        const { app } = buildAuthApp({ verifyGoogleCredential: verify });
        const agent = await createAuthAgent(app);
        const response = await agent
            .post(`${API}/google`)
            .send({ credential, nonce: "n-1" });
        const body = expectSuccess(response);
        expect(body.data.user).toMatchObject({
            email: "gina@example.test",
            authProviders: ["google"],
            hasPassword: false,
        });
        expect(verify).toHaveBeenCalledWith(credential, { nonce: "n-1" });
        expect(agent.cookie("sai_access")).toBeTruthy();
        expect(JSON.stringify(body)).not.toContain(credential);
    });

    it("passes GOOGLE_TOKEN_INVALID and GOOGLE_EMAIL_UNVERIFIED through as 401", async () => {
        for (const code of [
            "GOOGLE_TOKEN_INVALID",
            "GOOGLE_EMAIL_UNVERIFIED",
        ]) {
            const verify = vi.fn().mockRejectedValue(ApiError.fromCode(code));
            const { app } = buildAuthApp({ verifyGoogleCredential: verify });
            const agent = await createAuthAgent(app);
            expectError(
                await agent.post(`${API}/google`).send({ credential }),
                401,
                code
            );
        }
    });

    it("validates the body", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(
            await agent.post(`${API}/google`).send({}),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent.post(`${API}/google`).send({ credential: "short" }),
            400,
            "VALIDATION_ERROR"
        );
        expectError(
            await agent
                .post(`${API}/google`)
                .send({ credential, email: "x@example.test" }),
            400,
            "VALIDATION_ERROR"
        );
    });
});

describe("POST /auth/logout and /auth/logout-all", () => {
    it("logout revokes the session and clears all three cookies", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const response = await agent.post(`${API}/logout`);
        expectSuccess(response);
        const cleared = response.headers["set-cookie"].join("\n");
        for (const name of ["sai_access", "sai_refresh", "sai_csrf"])
            expect(cleared).toMatch(new RegExp(`${name}=;`));
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
    });

    it("logout is idempotent: with no cookies, twice, and with an unknown refresh cookie", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectSuccess(await agent.post(`${API}/logout`));
        await agent.prime();
        expectSuccess(await agent.post(`${API}/logout`));
        expectSuccess(
            await rawRequest(app, "post", `${API}/logout`, {
                cookies: { sai_refresh: "unknown-token" },
            })
        );
    });

    it("logout works with an expired access cookie (it needs only the refresh cookie)", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 20 * 60_000);
        expectSuccess(await agent.post(`${API}/logout`));
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
    });

    it("logout-all needs a session (401 AUTH_REQUIRED) and revokes every session of the user", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const anonymous = await createAuthAgent(app);
        expectError(
            await anonymous.post(`${API}/logout-all`),
            401,
            "AUTH_REQUIRED"
        );

        const first = await loginAs(app, user.email);
        const second = await loginAs(app, user.email);
        expectSuccess(await first.agent.post(`${API}/logout-all`));
        expect(
            await RefreshSession.countDocuments({
                userId: user._id,
                revokedAt: null,
            })
        ).toBe(0);
        await second.agent.prime();
        expectError(
            await second.agent.get(`${API}/me`),
            401,
            "SESSION_REVOKED"
        );
    });
});

describe("GET /auth/me", () => {
    it("answers 401 AUTH_REQUIRED without a cookie, 200 with the summary and needsOnboarding", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const anonymous = await createAuthAgent(app);
        expectError(await anonymous.get(`${API}/me`), 401, "AUTH_REQUIRED");
        const { agent } = await loginAs(app, user.email);
        const body = expectSuccess(await agent.get(`${API}/me`));
        expect(body.data).toMatchObject({
            user: { id: String(user._id), email: user.email },
            needsOnboarding: false,
        });
    });

    it("answers TOKEN_EXPIRED once the access token is older than 15 minutes while the cookie is still sent", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        const access = agent.cookie("sai_access");
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 15 * 60_000 + 5000);
        expectError(
            await rawRequest(app, "get", `${API}/me`, {
                cookies: { sai_access: access },
            }),
            401,
            "TOKEN_EXPIRED"
        );
        // a browser would already have dropped the cookie (Max-Age 900): that is AUTH_REQUIRED
        expectError(await agent.get(`${API}/me`), 401, "AUTH_REQUIRED");
    });

    it("rejects query parameters", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.get(`${API}/me?role=admin`),
            400,
            "VALIDATION_ERROR"
        );
    });
});

describe("GET /auth/sessions and DELETE /auth/sessions/:id", () => {
    it("lists own sessions with the current flag and never exposes hashes", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const stranger = await createUser();
        await loginAs(app, stranger.email);
        const first = await loginAs(app, user.email, TEST_PASSWORD, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36",
            },
        });
        await loginAs(app, user.email, TEST_PASSWORD, {
            headers: { "User-Agent": "curl/8.4.0" },
        });
        const body = expectSuccess(await first.agent.get(`${API}/sessions`));
        expect(body.data.items).toHaveLength(2);
        const current = body.data.items.filter((item) => item.current);
        expect(current).toHaveLength(1);
        expect(current[0].device).toBe("Chrome on Windows");
        expect(Object.keys(body.data.items[0]).sort()).toEqual([
            "createdAt",
            "current",
            "device",
            "id",
            "lastUsedAt",
        ]);
        expect(JSON.stringify(body)).not.toMatch(
            /tokenHash|ipHash|userAgentHash/
        );
    });

    it("revokes another own session; revoking the current one acts as logout and clears the cookies", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const first = await loginAs(app, user.email);
        const second = await loginAs(app, user.email);
        const list = (await first.agent.get(`${API}/sessions`)).body.data.items;
        const other = list.find((item) => !item.current);
        expectSuccess(await first.agent.delete(`${API}/sessions/${other.id}`));
        await second.agent.prime();
        expectError(
            await second.agent.get(`${API}/me`),
            401,
            "SESSION_REVOKED"
        );

        const current = (await first.agent.get(`${API}/sessions`)).body.data
            .items[0];
        const response = await first.agent.delete(
            `${API}/sessions/${current.id}`
        );
        expectSuccess(response);
        expect(response.headers["set-cookie"].join("\n")).toMatch(
            /sai_access=;/
        );
    });

    it("answers 400 INVALID_ID for a malformed id and 404 for an unknown or foreign session", async () => {
        const { app } = buildAuthApp();
        const user = await createUser();
        const stranger = await createUser();
        const theirs = await loginAs(app, stranger.email);
        const theirId = (await theirs.agent.get(`${API}/sessions`)).body.data
            .items[0].id;
        const { agent } = await loginAs(app, user.email);
        expectError(
            await agent.delete(`${API}/sessions/not-an-id`),
            400,
            "INVALID_ID"
        );
        expectError(
            await agent.delete(`${API}/sessions/${theirId}`),
            404,
            "NOT_FOUND"
        );
        expectError(
            await agent.delete(`${API}/sessions/64b7f0f0f0f0f0f0f0f0f0f1`),
            404,
            "NOT_FOUND"
        );
        expectSuccess(await theirs.agent.get(`${API}/me`));
    });

    it("requires a session for both routes", async () => {
        const { app } = buildAuthApp();
        const agent = await createAuthAgent(app);
        expectError(await agent.get(`${API}/sessions`), 401, "AUTH_REQUIRED");
        expectError(
            await agent.delete(`${API}/sessions/64b7f0f0f0f0f0f0f0f0f0f1`),
            401,
            "AUTH_REQUIRED"
        );
    });
});
