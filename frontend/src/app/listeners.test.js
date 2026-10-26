import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRouterBridge } from "@/app/listeners";
import { setupStore } from "@/app/store";
import {
    fetchSessions,
    loginUser,
    logoutAllDevices,
    logoutUser,
    removeAvatar,
    revokeSession,
    sessionExpired,
    undoEmailChange,
    updateProfile,
    uploadAvatar,
} from "@/features/auth";
import { authChannel } from "@/lib/authChannel";
import { makeSession } from "@/mocks/fixtures/session";
import { anonymousAuth, signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";
import { http } from "msw";
import { apiUrl, okResponse } from "@/mocks/fixtures/envelope";

const server = setupMockServer();

let navigate;
let post;

beforeEach(() => {
    navigate = vi.fn();
    post = vi.spyOn(authChannel, "post").mockReturnValue(true);
    setRouterBridge({
        navigate,
        getLocation: () => ({ pathname: "/gaps", search: "?tab=1", hash: "" }),
    });
});

afterEach(() => {
    setRouterBridge({});
    localStorage.clear();
});

describe("session end listener (FE-58)", () => {
    it("resets the app and goes to /session-expired with a safe return path", () => {
        const store = setupStore({
            auth: signedInAuth({}, { pendingEmail: "x@example.test" }),
        });
        store.dispatch(sessionExpired("SESSION_EXPIRED"));
        expect(store.getState().auth).toMatchObject({
            user: null,
            pendingEmail: null,
            sessionEnd: "SESSION_EXPIRED",
            bootstrapped: true,
        });
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("/session-expired", {
            replace: true,
            state: { returnTo: "/gaps?tab=1" },
        });
    });

    it("dedupes a storm of events into one navigation", () => {
        const store = setupStore({ auth: signedInAuth() });
        for (let index = 0; index < 5; index += 1)
            store.dispatch(sessionExpired("SESSION_EXPIRED"));
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it("does nothing for an anonymous visitor", () => {
        const store = setupStore({ auth: anonymousAuth });
        store.dispatch(sessionExpired("SESSION_EXPIRED"));
        expect(navigate).not.toHaveBeenCalled();
    });

    it("omits the return path when the current page is not returnable", () => {
        setRouterBridge({
            navigate,
            getLocation: () => ({ pathname: "/login", search: "", hash: "" }),
        });
        const store = setupStore({ auth: signedInAuth() });
        store.dispatch(sessionExpired("LOGOUT_OTHER_TAB"));
        expect(navigate).toHaveBeenCalledWith("/session-expired", {
            replace: true,
        });
        expect(store.getState().auth.sessionEnd).toBe("LOGOUT_OTHER_TAB");
    });

    it("does not navigate without a router bridge but still resets", () => {
        setRouterBridge({});
        const store = setupStore({ auth: signedInAuth() });
        expect(() =>
            store.dispatch(sessionExpired("SESSION_EXPIRED"))
        ).not.toThrow();
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("sign-in and sign-out listeners", () => {
    it("tells other tabs about a login", async () => {
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(
            loginUser({ email: "a@example.test", password: "p" })
        );
        expect(post).toHaveBeenCalledWith("login");
    });

    it.each([
        ["logoutUser", logoutUser],
        ["logoutAllDevices", logoutAllDevices],
    ])(
        "%s resets the app, notifies other tabs and goes to /login",
        async (_name, thunk) => {
            const store = setupStore({
                auth: signedInAuth(),
                sessions: undefined,
            });
            await store.dispatch(thunk());
            expect(post).toHaveBeenCalledWith("logout");
            expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
            expect(store.getState().auth).toMatchObject({
                user: null,
                sessionEnd: "LOGOUT",
                bootstrapped: true,
            });
        }
    );

    it("wipes the previous user's data on logout", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        expect(store.getState().sessions.ids.length).toBeGreaterThan(0);
        await store.dispatch(logoutUser());
        expect(store.getState().sessions.ids).toEqual([]);
    });

    it("treats revoking the current session like a logout", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse([makeSession()])
            )
        );
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        await store.dispatch(revokeSession({ id: makeSession().id }));
        expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
        expect(post).toHaveBeenCalledWith("logout");
    });

    it("leaves other sessions' revocation alone", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const other = Object.values(store.getState().sessions.entities).find(
            (session) => !session.current
        );
        await store.dispatch(revokeSession({ id: other.id }));
        expect(navigate).not.toHaveBeenCalled();
        expect(store.getState().auth.user).not.toBeNull();
    });
});

describe("profile listeners", () => {
    it.each([
        [
            "updateProfile",
            () => updateProfile({ name: "Asha V" }),
            "name",
            "Asha V",
        ],
        [
            "uploadAvatar",
            () =>
                uploadAvatar({
                    file: new File(["x"], "a.png", { type: "image/png" }),
                }),
            "avatar",
            { publicId: "samarth-ai/test/avatars/a1", version: 1 },
        ],
        ["removeAvatar", () => removeAvatar(), "avatar", null],
    ])(
        "%s merges the fresh user summary into the auth user",
        async (_name, thunk, field, expected) => {
            const store = setupStore({
                auth: signedInAuth({
                    avatar: { publicId: "old", version: 0 },
                    needsOnboarding: false,
                }),
            });
            await store.dispatch(thunk());
            const { user } = store.getState().auth;
            expect(user[field]).toEqual(expected);
            expect(user.needsOnboarding).toBe(false);
            expect(user.timezone).toBeUndefined();
        }
    );

    it("leaves an anonymous store alone", async () => {
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(updateProfile({ name: "Asha V" }));
        expect(store.getState().auth.user).toBeNull();
    });
});

describe("undo email change listener (R38)", () => {
    it("drops the local session without a redirect and tells the other tabs", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(undoEmailChange({ token: "t-123456" }));
        expect(store.getState().auth).toMatchObject({
            user: null,
            bootstrapped: true,
        });
        expect(post).toHaveBeenCalledWith("logout");
        expect(navigate).not.toHaveBeenCalled();
    });

    it("does nothing for a visitor who is not signed in here", async () => {
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(undoEmailChange({ token: "t-123456" }));
        expect(post).not.toHaveBeenCalled();
    });
});

describe("language from the signed-in user (FE-82)", () => {
    const hindiUser = { locale: "hi" };

    it("applies the user's locale when there is no persisted choice", async () => {
        server.use(
            http.post(apiUrl("/auth/login"), () =>
                okResponse({
                    user: { id: "1", role: "learner", ...hindiUser },
                    needsOnboarding: false,
                })
            )
        );
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(
            loginUser({ email: "a@example.test", password: "p" })
        );
        expect(store.getState().ui.language).toBe("hi");
        expect(localStorage.getItem("sai-lang")).toBeNull();
    });

    it("keeps the persisted choice over the user's setting", async () => {
        localStorage.setItem("sai-lang", "en");
        server.use(
            http.post(apiUrl("/auth/login"), () =>
                okResponse({
                    user: { id: "1", role: "learner", ...hindiUser },
                    needsOnboarding: false,
                })
            )
        );
        const store = setupStore({ auth: anonymousAuth });
        await store.dispatch(
            loginUser({ email: "a@example.test", password: "p" })
        );
        expect(store.getState().ui.language).toBe("en");
    });
});
