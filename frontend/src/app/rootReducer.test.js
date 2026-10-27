import { describe, expect, it } from "vitest";
import { resetApp } from "@/app/actions";
import { rootReducer } from "@/app/rootReducer";
import { setupStore } from "@/app/store";
import { sessionExpired } from "@/features/auth";
import { themeChanged } from "@/features/preferences";
import { signedInAuth } from "@/test/authState";

describe("rootReducer", () => {
    it("has one key per slice, equal to the slice name", () => {
        expect(Object.keys(setupStore().getState()).sort()).toEqual([
            "account",
            "adminUsers",
            "auth",
            "invites",
            "profile",
            "registration",
            "sessions",
            "ui",
        ]);
    });

    it("passes other actions straight to the slices", () => {
        const store = setupStore();
        store.dispatch(themeChanged("dark"));
        expect(store.getState().ui.theme).toBe("dark");
    });
});

describe("resetApp", () => {
    it("wipes the user, sessions and account state but keeps the ui preferences", () => {
        const store = setupStore({
            auth: signedInAuth(
                {},
                {
                    pendingEmail: "a@example.test",
                    ops: {
                        loginUser: { status: "failed", error: { code: "X" } },
                    },
                }
            ),
            sessions: {
                ids: ["s1"],
                entities: { s1: { id: "s1" } },
                status: "succeeded",
                error: null,
                lastFetchedAt: 1,
                revoke: { status: "idle", error: null },
            },
            invites: {
                ids: ["i1"],
                entities: { i1: { id: "i1" } },
                status: "succeeded",
                error: null,
                lastFetchedAt: 1,
                queryKey: "k",
                requestId: "r",
                loadedKey: "k",
                meta: { page: 2, limit: 20, total: 30, totalPages: 2 },
                ops: {},
            },
            ui: {
                theme: "dark",
                language: "hi",
                sidebarCollapsed: true,
                offline: false,
                serverWaking: false,
            },
        });
        store.dispatch(resetApp());
        const state = store.getState();
        expect(state.auth).toMatchObject({
            user: null,
            bootstrapped: true,
            pendingEmail: null,
            ops: {},
            status: "idle",
            lastFetchedAt: null,
        });
        expect(state.sessions.ids).toEqual([]);
        expect(state.invites.ids).toEqual([]);
        expect(state.invites.loadedKey).toBeNull();
        expect(state.adminUsers.ids).toEqual([]);
        expect(state.account.ops).toEqual({});
        expect(state.ui).toEqual({
            theme: "dark",
            language: "hi",
            sidebarCollapsed: true,
            offline: false,
            serverWaking: false,
        });
    });

    it("leaves auth anonymous but bootstrapped, keeping the reason the session ended", () => {
        const store = setupStore({ auth: signedInAuth() });
        store.dispatch(sessionExpired("SESSION_REVOKED"));
        store.dispatch(resetApp());
        expect(store.getState().auth).toMatchObject({
            user: null,
            bootstrapped: true,
            sessionEnd: "SESSION_REVOKED",
        });
    });

    it("works from an undefined state (first action)", () => {
        const state = rootReducer(undefined, resetApp());
        expect(state.auth).toMatchObject({
            user: null,
            bootstrapped: true,
            sessionEnd: null,
        });
    });

    it("does not carry a limited session or onboarding skip over to the next user", () => {
        const store = setupStore({
            auth: signedInAuth(
                {},
                {
                    limitedSession: true,
                    onboardingSkipped: true,
                    reactivated: true,
                    lockout: { until: 5 },
                }
            ),
        });
        store.dispatch(resetApp());
        expect(store.getState().auth).toMatchObject({
            limitedSession: false,
            onboardingSkipped: false,
            reactivated: false,
            lockout: null,
        });
    });
});
