import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapApp, rootErrorHandlers } from "@/app/bootstrap";
import { setupStore } from "@/app/store";
import { API_EVENTS, apiEvents } from "@/lib/apiEvents";
import { authChannel } from "@/lib/authChannel";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

function fakeRouter(pathname = "/dashboard") {
    return {
        navigate: vi.fn(),
        state: { location: { pathname, search: "", hash: "" } },
    };
}

let running;
let channelHandler;

beforeEach(() => {
    running = null;
    channelHandler = null;
    vi.spyOn(authChannel, "post").mockReturnValue(true);
    vi.spyOn(authChannel, "subscribe").mockImplementation((handler) => {
        channelHandler = handler;
        return () => {};
    });
});

afterEach(() => {
    running?.dispose();
    apiEvents.clear();
    document.documentElement.classList.remove("dark");
});

function start(store, router = fakeRouter()) {
    running = bootstrapApp({ store, router });
    return running;
}

describe("hydration before first render (FE-53, R5)", () => {
    it("signs the user in from /auth/me", async () => {
        const store = setupStore();
        await start(store).hydrated;
        expect(store.getState().auth).toMatchObject({
            bootstrapped: true,
            user: expect.objectContaining({ role: "learner" }),
        });
    });

    it("refreshes exactly once when the access cookie has expired, then retries /auth/me", async () => {
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
        await start(store).hydrated;
        expect(calls).toEqual({ me: 2, refresh: 1 });
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("treats a visitor without cookies as anonymous after one failed refresh, with no navigation", async () => {
        const calls = { refresh: 0 };
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                errorResponse(401, "AUTH_REQUIRED")
            ),
            http.post(apiUrl("/auth/refresh"), () => {
                calls.refresh += 1;
                return errorResponse(401, "REFRESH_INVALID");
            })
        );
        const router = fakeRouter("/");
        const store = setupStore();
        await start(store, router).hydrated;
        expect(calls.refresh).toBe(1);
        expect(store.getState().auth).toMatchObject({
            user: null,
            bootstrapped: true,
            sessionEnd: null,
        });
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it("applies the stored theme before anything renders", () => {
        const store = setupStore({
            ui: {
                theme: "dark",
                language: "en",
                sidebarCollapsed: false,
                offline: false,
                serverWaking: false,
            },
        });
        server.use(
            http.get(apiUrl("/auth/me"), () =>
                errorResponse(401, "AUTH_REQUIRED")
            ),
            http.post(apiUrl("/auth/refresh"), () =>
                errorResponse(401, "REFRESH_INVALID")
            )
        );
        start(store);
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
});

describe("event wiring", () => {
    it("turns apiClient session-expired events into the session-end flow", async () => {
        const router = fakeRouter("/gaps");
        const store = setupStore({ auth: signedInAuth() });
        await start(store, router).hydrated;
        apiEvents.emit(API_EVENTS.SESSION_EXPIRED, {
            reason: "SESSION_REVOKED",
        });
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: "SESSION_REVOKED",
        });
        expect(router.navigate).toHaveBeenCalledWith("/session-expired", {
            replace: true,
            state: { returnTo: "/gaps" },
        });
    });

    it("mirrors the server-waking banner into the ui slice", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await start(store).hydrated;
        apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: true });
        expect(store.getState().ui.serverWaking).toBe(true);
        apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: false });
        expect(store.getState().ui.serverWaking).toBe(false);
    });

    it("signs this tab out without an API call when another tab logs out", async () => {
        let logoutCalls = 0;
        server.use(
            http.post(apiUrl("/auth/logout"), () => {
                logoutCalls += 1;
                return okResponse(null);
            })
        );
        const router = fakeRouter("/chat");
        const store = setupStore({ auth: signedInAuth() });
        await start(store, router).hydrated;
        channelHandler("logout");
        expect(store.getState().auth).toMatchObject({
            user: null,
            sessionEnd: "LOGOUT_OTHER_TAB",
        });
        expect(router.navigate).toHaveBeenCalledWith(
            "/session-expired",
            expect.objectContaining({ replace: true })
        );
        expect(logoutCalls).toBe(0);
    });

    it("rehydrates when another tab logs in", async () => {
        let meCalls = 0;
        server.use(
            http.get(apiUrl("/auth/me"), () => {
                meCalls += 1;
                return okResponse({ user: makeUser() });
            })
        );
        const store = setupStore();
        await start(store).hydrated;
        channelHandler("login");
        await vi.waitFor(() => expect(meCalls).toBe(2));
    });

    it("tracks the browser going offline and online", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await start(store).hydrated;
        window.dispatchEvent(new Event("offline"));
        expect(store.getState().ui.offline).toBe(true);
        window.dispatchEvent(new Event("online"));
        expect(store.getState().ui.offline).toBe(false);
    });

    it("refetches /auth/me when a page is restored from the back-forward cache", async () => {
        let meCalls = 0;
        server.use(
            http.get(apiUrl("/auth/me"), () => {
                meCalls += 1;
                return okResponse({ user: makeUser() });
            })
        );
        const store = setupStore();
        await start(store).hydrated;
        const restored = new Event("pageshow");
        restored.persisted = true;
        window.dispatchEvent(restored);
        await vi.waitFor(() => expect(meCalls).toBe(2));
        const ordinary = new Event("pageshow");
        ordinary.persisted = false;
        window.dispatchEvent(ordinary);
        expect(meCalls).toBe(2);
    });

    it("stops reacting after dispose", async () => {
        const store = setupStore({ auth: signedInAuth() });
        const handle = start(store);
        await handle.hydrated;
        handle.dispose();
        apiEvents.emit(API_EVENTS.SERVER_WAKING, { active: true });
        window.dispatchEvent(new Event("offline"));
        expect(store.getState().ui).toMatchObject({
            serverWaking: false,
            offline: false,
        });
    });
});

describe("global error handlers (FE-110)", () => {
    it("log and never throw or toast", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(() =>
            rootErrorHandlers.onUncaughtError(new Error("boom"), {
                componentStack: "at X",
            })
        ).not.toThrow();
        expect(() =>
            rootErrorHandlers.onCaughtError(new Error("boom"))
        ).not.toThrow();
        expect(() =>
            rootErrorHandlers.onRecoverableError(new Error("boom"))
        ).not.toThrow();
        expect(error).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(2);
        expect(
            JSON.stringify([...error.mock.calls, ...warn.mock.calls])
        ).not.toContain("boom");
    });

    it("log window errors and unhandled rejections without leaking messages", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const store = setupStore({ auth: signedInAuth() });
        await start(store).hydrated;
        window.dispatchEvent(
            new ErrorEvent("error", { error: new TypeError("secret detail") })
        );
        const rejection = new Event("unhandledrejection");
        rejection.reason = new RangeError("secret reason");
        window.dispatchEvent(rejection);
        expect(error).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
    });
});
