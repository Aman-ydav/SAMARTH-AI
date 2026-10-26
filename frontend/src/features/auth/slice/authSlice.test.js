import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupStore } from "@/app/store";
import { API_EVENTS, apiEvents } from "@/lib/apiEvents";
import {
    SESSION_END,
    fetchCurrentUser,
    loginUser,
    loginWithGoogle,
    lockoutCleared,
    logoutAllDevices,
    logoutUser,
    onboardingSkipped,
    pendingEmailSet,
    reactivationAcknowledged,
    registerUser,
    selectAuthGate,
    selectAuthOp,
    selectCurrentUser,
    selectIsAuthenticated,
    selectMustChangePassword,
    selectNeedsOnboarding,
    selectPendingEmail,
    selectUserRole,
    sessionExpired,
    userPatched,
    verifyEmail,
} from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSessionData, makeUser } from "@/mocks/fixtures/user";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

afterEach(() => {
    apiEvents.clear();
    vi.useRealTimers();
});

const failWith = (path, status, code, extra, method = "post") =>
    server.use(
        http[method](apiUrl(path), () => errorResponse(status, code, extra))
    );

describe("initial state and plain reducers", () => {
    it("starts anonymous, not bootstrapped, with the shared slice fields", () => {
        const { auth } = setupStore().getState();
        expect(auth).toMatchObject({
            user: null,
            bootstrapped: false,
            sessionEnd: null,
            status: "idle",
            error: null,
            lastFetchedAt: null,
            ops: {},
        });
        expect(Object.keys(auth).join()).not.toMatch(/token|password|csrf/i);
    });

    it("ends the session with a known reason and falls back for unknown ones", () => {
        const store = setupStore({ auth: signedInAuth() });
        store.dispatch(sessionExpired("SESSION_REVOKED"));
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: "SESSION_REVOKED",
            bootstrapped: true,
        });
        store.dispatch(sessionExpired("whatever"));
        expect(store.getState().auth.sessionEnd).toBe("SESSION_EXPIRED");
    });

    it("patches the signed-in user only", () => {
        const store = setupStore({ auth: signedInAuth() });
        store.dispatch(userPatched({ name: "Renamed" }));
        expect(selectCurrentUser(store.getState()).name).toBe("Renamed");
        const anonymous = setupStore();
        anonymous.dispatch(userPatched({ name: "Ghost" }));
        expect(selectCurrentUser(anonymous.getState())).toBeNull();
    });

    it("tracks the pending email, reactivation, onboarding skip and lockout flags", () => {
        const store = setupStore({
            auth: signedInAuth(
                { needsOnboarding: true },
                { reactivated: true, lockout: { until: 1 } }
            ),
        });
        store.dispatch(pendingEmailSet("new@example.test"));
        expect(selectPendingEmail(store.getState())).toBe("new@example.test");
        store.dispatch(pendingEmailSet(""));
        expect(selectPendingEmail(store.getState())).toBeNull();
        store.dispatch(reactivationAcknowledged());
        store.dispatch(lockoutCleared());
        expect(store.getState().auth).toMatchObject({
            reactivated: false,
            lockout: null,
        });
        store.dispatch(onboardingSkipped());
        expect(selectNeedsOnboarding(store.getState())).toBe(false);
    });

    it("exposes memoised selectors", () => {
        const state = setupStore({
            auth: signedInAuth({ role: "trainer", mustChangePassword: true }),
        }).getState();
        expect(selectIsAuthenticated(state)).toBe(true);
        expect(selectUserRole(state)).toBe("trainer");
        expect(selectMustChangePassword(state)).toBe(true);
        expect(selectAuthGate(state)).toBe(selectAuthGate(state));
        expect(selectAuthGate(state)).toMatchObject({
            bootstrapped: true,
            mustChangePassword: true,
        });
        expect(selectAuthOp(state, "loginUser")).toEqual({
            status: "idle",
            error: null,
        });
    });
});

describe("fetchCurrentUser", () => {
    it("hydrates the user and merges needsOnboarding", async () => {
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                okResponse({
                    user: makeUser({ role: "trainer" }),
                    needsOnboarding: true,
                })
            )
        );
        const store = setupStore();
        await store.dispatch(fetchCurrentUser());
        const { auth } = store.getState();
        expect(auth).toMatchObject({
            bootstrapped: true,
            status: "succeeded",
            error: null,
            sessionEnd: null,
        });
        expect(auth.user).toMatchObject({
            role: "trainer",
            needsOnboarding: true,
        });
        expect(auth.lastFetchedAt).toEqual(expect.any(Number));
    });

    it("does exactly one refresh when the access cookie expired, then retries /auth/me (R5)", async () => {
        const calls = { me: 0, refresh: 0 };
        let refreshed = false;
        server.use(
            http.get(apiUrl("/auth/me"), () => {
                calls.me += 1;
                return refreshed
                    ? okResponse({ user: makeUser() })
                    : errorResponse(401, "TOKEN_EXPIRED");
            }),
            http.post(apiUrl("/auth/refresh"), () => {
                calls.refresh += 1;
                refreshed = true;
                return okResponse(null);
            })
        );
        const store = setupStore();
        await store.dispatch(fetchCurrentUser());
        expect(calls).toEqual({ me: 2, refresh: 1 });
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("treats an anonymous visitor as a normal result: one refresh, no session-expired", async () => {
        const events = [];
        apiEvents.on(API_EVENTS.SESSION_EXPIRED, (detail) =>
            events.push(detail)
        );
        const calls = { me: 0, refresh: 0 };
        server.use(
            http.get(apiUrl("/auth/me"), () => {
                calls.me += 1;
                return errorResponse(401, "AUTH_REQUIRED");
            }),
            http.post(apiUrl("/auth/refresh"), () => {
                calls.refresh += 1;
                return errorResponse(401, "REFRESH_INVALID");
            })
        );
        const store = setupStore();
        await store.dispatch(fetchCurrentUser());
        expect(calls).toEqual({ me: 1, refresh: 1 });
        expect(events).toHaveLength(0);
        expect(store.getState().auth).toMatchObject({
            user: null,
            bootstrapped: true,
            status: "succeeded",
            error: null,
            sessionEnd: null,
        });
    });

    it("keeps the boot gate closed on a transient failure so the UI can offer Retry", async () => {
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                errorResponse(503, "INTEGRATION_ERROR")
            )
        );
        vi.useFakeTimers({ toFake: ["setTimeout"], shouldAdvanceTime: true });
        const store = setupStore();
        const pending = store.dispatch(fetchCurrentUser());
        for (let step = 0; step < 30; step += 1)
            await vi.advanceTimersByTimeAsync(250);
        await pending;
        const { auth } = store.getState();
        expect(auth).toMatchObject({
            bootstrapped: false,
            status: "failed",
            user: null,
        });
        expect(auth.error).toMatchObject({ statusCode: 503 });
    });

    it("marks a revoked or expired session when a signed-in user is revalidated", async () => {
        failWith("/auth/me", 401, "SESSION_REVOKED", undefined, "get");
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchCurrentUser({ force: true }));
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: "SESSION_REVOKED",
            bootstrapped: true,
        });
    });

    it("keeps a signed-in user when revalidation fails transiently", async () => {
        failWith("/auth/me", 500, "INTERNAL", undefined, "get");
        vi.useFakeTimers({ toFake: ["setTimeout"], shouldAdvanceTime: true });
        const store = setupStore({ auth: signedInAuth() });
        const pending = store.dispatch(fetchCurrentUser({ force: true }));
        for (let step = 0; step < 30; step += 1)
            await vi.advanceTimersByTimeAsync(250);
        await pending;
        expect(store.getState().auth).toMatchObject({
            bootstrapped: true,
            status: "failed",
        });
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("flags a limited must-change-password session", async () => {
        failWith("/auth/me", 403, "MUST_CHANGE_PASSWORD", undefined, "get");
        const store = setupStore();
        await store.dispatch(fetchCurrentUser());
        expect(store.getState().auth).toMatchObject({
            user: null,
            limitedSession: true,
            bootstrapped: true,
            status: "succeeded",
        });
    });

    it("rejects a 200 without a user as INVALID_RESPONSE", async () => {
        server.use(http.get(apiUrl("/auth/me"), () => okResponse({})));
        const store = setupStore();
        await store.dispatch(fetchCurrentUser());
        expect(store.getState().auth.error).toMatchObject({
            code: "INVALID_RESPONSE",
        });
        expect(store.getState().auth.bootstrapped).toBe(false);
    });

    it("skips the request while one is loading and while the user is fresh, unless forced", async () => {
        let calls = 0;
        server.use(
            http.get(apiUrl("/auth/me"), () => {
                calls += 1;
                return okResponse({ user: makeUser() });
            })
        );
        const store = setupStore();
        await Promise.all([
            store.dispatch(fetchCurrentUser()),
            store.dispatch(fetchCurrentUser()),
        ]);
        expect(calls).toBe(1);
        await store.dispatch(fetchCurrentUser());
        expect(calls).toBe(1);
        await store.dispatch(fetchCurrentUser({ force: true }));
        expect(calls).toBe(2);
    });

    it("does not report an aborted hydrate as a failure", async () => {
        server.use(
            http.get(apiUrl("/auth/me"), async () => new Promise(() => {}))
        );
        const store = setupStore();
        const pending = store.dispatch(fetchCurrentUser());
        pending.abort();
        await pending;
        expect(store.getState().auth).toMatchObject({
            status: "idle",
            error: null,
        });
    });
});

describe("loginUser", () => {
    const credentials = {
        email: "asha@example.test",
        password: "correct horse battery",
        rememberMe: false,
    };

    it("signs in and keeps no secret in state", async () => {
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(loginUser(credentials));
        const { auth } = store.getState();
        expect(auth.user).toMatchObject({
            email: "asha.verma@example.test",
            needsOnboarding: false,
        });
        expect(auth).toMatchObject({
            sessionEnd: null,
            reactivated: false,
            lockout: null,
        });
        expect(JSON.stringify(store.getState())).not.toContain(
            "correct horse battery"
        );
    });

    it("carries the reactivation flag so the page can show its confirm screen", async () => {
        server.use(
            http.post(apiUrl("/auth/login"), () =>
                okResponse(makeSessionData({ reactivate: true }))
            )
        );
        const store = setupStore();
        await store.dispatch(loginUser(credentials));
        expect(store.getState().auth.reactivated).toBe(true);
        store.dispatch(reactivationAcknowledged());
        expect(store.getState().auth.reactivated).toBe(false);
    });

    it("signs in a must-change-password user with the flag on the user", async () => {
        server.use(
            http.post(apiUrl("/auth/login"), () =>
                okResponse(makeSessionData({}, { mustChangePassword: true }))
            )
        );
        const store = setupStore();
        await store.dispatch(loginUser(credentials));
        expect(selectMustChangePassword(store.getState())).toBe(true);
    });

    it("reports a wrong password without touching the session", async () => {
        failWith("/auth/login", 401, "INVALID_CREDENTIALS");
        const store = setupStore({ auth: anonymousAuth });
        const result = await store.dispatch(loginUser(credentials));
        expect(result.payload.code).toBe("INVALID_CREDENTIALS");
        expect(selectAuthOp(store.getState(), "loginUser")).toMatchObject({
            status: "failed",
            error: { code: "INVALID_CREDENTIALS" },
        });
        expect(store.getState().auth.user).toBeNull();
    });

    it("keeps the email for the resend offer when it is unverified", async () => {
        failWith("/auth/login", 403, "EMAIL_NOT_VERIFIED");
        const store = setupStore();
        await store.dispatch(loginUser(credentials));
        expect(selectPendingEmail(store.getState())).toBe("asha@example.test");
    });

    it("stores an absolute lockout deadline", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
        failWith("/auth/login", 423, "ACCOUNT_LOCKED", {
            headers: { "Retry-After": "900" },
        });
        const store = setupStore();
        await store.dispatch(loginUser(credentials));
        expect(store.getState().auth.lockout).toEqual({
            until: Date.parse("2026-10-26T10:00:00Z") + 900000,
        });
        store.dispatch(lockoutCleared());
        expect(store.getState().auth.lockout).toBeNull();
    });

    it.each([
        [403, "ACCOUNT_SUSPENDED"],
        [403, "ACCOUNT_DEACTIVATED"],
        [429, "RATE_LIMITED"],
        [403, "CSRF_INVALID"],
    ])("rejects %i %s and stays anonymous", async (status, code) => {
        failWith("/auth/login", status, code);
        const store = setupStore();
        const result = await store.dispatch(loginUser(credentials));
        expect(result.payload).toMatchObject({ statusCode: status, code });
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("loginWithGoogle", () => {
    it("signs in with a Google credential", async () => {
        const store = setupStore();
        await store.dispatch(
            loginWithGoogle({ credential: "google-id-token" })
        );
        expect(store.getState().auth.user).toMatchObject({
            authProviders: ["google"],
            hasPassword: false,
        });
        expect(JSON.stringify(store.getState())).not.toContain(
            "google-id-token"
        );
    });

    it.each([
        [401, "GOOGLE_TOKEN_INVALID"],
        [401, "GOOGLE_EMAIL_UNVERIFIED"],
        [403, "DOMAIN_NOT_ALLOWED"],
        [403, "ACCOUNT_SUSPENDED"],
    ])("rejects %i %s", async (status, code) => {
        failWith("/auth/google", status, code);
        const store = setupStore();
        const result = await store.dispatch(
            loginWithGoogle({ credential: "x" })
        );
        expect(result.payload).toMatchObject({ statusCode: status, code });
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("logoutUser and logoutAllDevices", () => {
    it.each([
        ["logoutUser", logoutUser, "/auth/logout"],
        ["logoutAllDevices", logoutAllDevices, "/auth/logout-all"],
    ])("%s ends the session honestly on success", async (_name, thunk) => {
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(thunk());
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: SESSION_END.LOGOUT,
            bootstrapped: true,
        });
    });

    it.each([
        ["logoutUser", logoutUser, "/auth/logout"],
        ["logoutAllDevices", logoutAllDevices, "/auth/logout-all"],
    ])("%s treats a 401 as already signed out", async (_name, thunk, path) => {
        failWith(path, 401, "AUTH_REQUIRED");
        const store = setupStore({ auth: signedInAuth() });
        const result = await store.dispatch(thunk());
        expect(result.payload).toEqual({ alreadyEnded: true });
        expect(store.getState().auth.user).toBeNull();
    });

    it.each([
        ["logoutUser", logoutUser, "/auth/logout"],
        ["logoutAllDevices", logoutAllDevices, "/auth/logout-all"],
    ])(
        "%s keeps the user signed in when the server cannot be reached",
        async (name, thunk, path) => {
            failWith(path, 503, "INTEGRATION_ERROR");
            const store = setupStore({ auth: signedInAuth() });
            const result = await store.dispatch(thunk());
            expect(result.payload).toMatchObject({ statusCode: 503 });
            expect(store.getState().auth.user).not.toBeNull();
            expect(selectAuthOp(store.getState(), name)).toMatchObject({
                status: "failed",
            });
        }
    );
});

describe("no secrets in state", () => {
    beforeEach(() => (document.cookie = "sai_csrf=csrf-secret-value; path=/"));
    afterEach(() => {
        document.cookie =
            "sai_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    });

    it("never stores passwords, tokens, credentials or the CSRF value across a full flow", async () => {
        const store = setupStore();
        await store.dispatch(
            registerUser({
                name: "A B",
                email: "a@example.test",
                password: "pw-secret-123456",
                acceptTerms: true,
            })
        );
        await store.dispatch(verifyEmail({ token: "token-secret-abc" }));
        await store.dispatch(
            loginUser({ email: "a@example.test", password: "pw-secret-123456" })
        );
        await store.dispatch(
            loginWithGoogle({ credential: "credential-secret" })
        );
        const serialised = JSON.stringify(store.getState());
        for (const secret of [
            "pw-secret-123456",
            "token-secret-abc",
            "credential-secret",
            "csrf-secret-value",
        ])
            expect(serialised).not.toContain(secret);
    });
});

describe("defensive reducers (actions without a payload)", () => {
    it("records an unknown failure when a hydrate rejects without a payload", () => {
        const store = setupStore();
        store.dispatch(
            fetchCurrentUser.rejected(new Error("boom"), "request-1", undefined)
        );
        expect(store.getState().auth).toMatchObject({
            status: "failed",
            bootstrapped: false,
            error: { code: "UNKNOWN" },
        });
    });

    it("ignores a sign-in rejection that carries no payload", () => {
        const store = setupStore();
        store.dispatch(
            loginUser.rejected(new Error("boom"), "request-1", {
                email: "a@example.test",
            })
        );
        expect(store.getState().auth).toMatchObject({
            pendingEmail: null,
            lockout: null,
        });
        expect(selectAuthOp(store.getState(), "loginUser")).toMatchObject({
            status: "failed",
            error: { code: "UNKNOWN" },
        });
    });

    it("keeps the lockout deadline relative to zero when the time is unknown", () => {
        const store = setupStore();
        store.dispatch(
            loginUser.rejected(
                new Error("locked"),
                "request-1",
                { email: "a@example.test" },
                {
                    statusCode: 423,
                    code: "ACCOUNT_LOCKED",
                    message: "",
                    errors: [],
                    retryAfterSec: 10,
                    requestId: null,
                }
            )
        );
        expect(store.getState().auth.lockout).toEqual({ until: 10000 });
    });

    it("does not remember a non-string email for the resend offer", () => {
        const store = setupStore();
        store.dispatch(
            loginUser.rejected(
                new Error("x"),
                "request-1",
                { email: 5 },
                {
                    statusCode: 403,
                    code: "EMAIL_NOT_VERIFIED",
                    message: "",
                    errors: [],
                    retryAfterSec: null,
                    requestId: null,
                }
            )
        );
        expect(selectPendingEmail(store.getState())).toBeNull();
    });

    it("ignores empty account responses when nobody is signed in", async () => {
        const store = setupStore({ auth: anonymousAuth });
        const { changePassword, unlinkGoogle } =
            await import("@/features/auth");
        server.use(
            http.post(apiUrl("/auth/change-password"), () => okResponse(null)),
            http.delete(apiUrl("/auth/google"), () => okResponse(null))
        );
        await store.dispatch(
            changePassword({ currentPassword: "a", newPassword: "b" })
        );
        await store.dispatch(unlinkGoogle({ credential: "c" }));
        expect(store.getState().auth.user).toBeNull();
    });
});
