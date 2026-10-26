import { http } from "msw";
import { describe, expect, it } from "vitest";
import { setupStore } from "@/app/store";
import {
    fetchSessions,
    revokeOtherSessions,
    revokeSession,
    selectAllSessions,
    selectOtherSessions,
    selectRevokeSessionOp,
    selectSessionById,
    selectSessionsError,
    selectSessionsStatus,
} from "@/features/auth";
import { apiUrl, errorResponse, okResponse } from "@/mocks/fixtures/envelope";
import { makeSession } from "@/mocks/fixtures/session";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

describe("fetchSessions", () => {
    it("loads the device list, newest activity first, and marks the current one", async () => {
        const store = setupStore({ auth: signedInAuth() });
        const pending = store.dispatch(fetchSessions());
        expect(selectSessionsStatus(store.getState())).toBe("loading");
        await pending;
        const sessions = selectAllSessions(store.getState());
        expect(sessions.map((session) => session.device)).toEqual([
            "Chrome on Windows",
            "Firefox on Linux",
        ]);
        expect(sessions[0].current).toBe(true);
        expect(selectOtherSessions(store.getState())).toHaveLength(1);
        expect(selectSessionById(store.getState(), sessions[1].id).device).toBe(
            "Firefox on Linux"
        );
        expect(store.getState().sessions.lastFetchedAt).toEqual(
            expect.any(Number)
        );
    });

    it("tolerates malformed rows and non-array bodies", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse([null, { nope: true }, { id: "s1" }])
            )
        );
        const store = setupStore();
        await store.dispatch(fetchSessions());
        expect(selectAllSessions(store.getState())).toEqual([
            {
                id: "s1",
                device: "",
                createdAt: null,
                lastUsedAt: null,
                current: false,
            },
        ]);
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse({ unexpected: true })
            )
        );
        await store.dispatch(fetchSessions());
        expect(selectAllSessions(store.getState())).toEqual([]);
    });

    it("stores the error when the server fails and does not run twice concurrently", async () => {
        let calls = 0;
        server.use(
            http.get(apiUrl("/auth/sessions"), () => {
                calls += 1;
                return errorResponse(403, "FORBIDDEN");
            })
        );
        const store = setupStore();
        await Promise.all([
            store.dispatch(fetchSessions()),
            store.dispatch(fetchSessions()),
        ]);
        expect(calls).toBe(1);
        expect(selectSessionsStatus(store.getState())).toBe("failed");
        expect(selectSessionsError(store.getState())).toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("does not treat a cancelled request as a failure", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () => new Promise(() => {}))
        );
        const store = setupStore();
        const pending = store.dispatch(fetchSessions());
        pending.abort();
        await pending;
        expect(selectSessionsStatus(store.getState())).toBe("idle");
        expect(selectSessionsError(store.getState())).toBeNull();
    });
});

describe("revokeSession", () => {
    it("removes the revoked device and reports whether it was the current one", async () => {
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const [current, other] = selectAllSessions(store.getState());
        const result = await store.dispatch(revokeSession({ id: other.id }));
        expect(result.payload).toEqual({ id: other.id, wasCurrent: false });
        expect(
            selectAllSessions(store.getState()).map((session) => session.id)
        ).toEqual([current.id]);
        expect(selectRevokeSessionOp(store.getState())).toEqual({
            status: "succeeded",
            error: null,
        });
    });

    it("flags the current session so the app can sign out", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse([makeSession()])
            )
        );
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const result = await store.dispatch(
            revokeSession({ id: makeSession().id })
        );
        expect(result.payload.wasCurrent).toBe(true);
        expect(store.getState().auth.user).toBeNull();
        expect(store.getState().auth.sessionEnd).toBe("LOGOUT");
    });

    it.each([
        [404, "NOT_FOUND"],
        [400, "INVALID_ID"],
    ])("keeps the row when the server answers %i %s", async (status, code) => {
        server.use(
            http.delete(apiUrl("/auth/sessions/:id"), () =>
                errorResponse(status, code)
            )
        );
        const store = setupStore();
        await store.dispatch(fetchSessions());
        const [first] = selectAllSessions(store.getState());
        const result = await store.dispatch(revokeSession({ id: first.id }));
        expect(result.payload.code).toBe(code);
        expect(selectAllSessions(store.getState())).toHaveLength(2);
        expect(selectRevokeSessionOp(store.getState())).toMatchObject({
            status: "failed",
            error: { code },
        });
    });

    it("encodes the id in the path", async () => {
        let seen = "";
        server.use(
            http.delete(apiUrl("/auth/sessions/:id"), ({ params }) => {
                seen = params.id;
                return okResponse(null);
            })
        );
        await setupStore().dispatch(revokeSession({ id: "a/b" }));
        expect(seen).toBe("a/b");
    });
});

describe("revokeOtherSessions", () => {
    const threeSessions = [
        makeSession(),
        makeSession({
            id: "s-b",
            device: "Firefox on Linux",
            current: false,
            lastUsedAt: "2026-10-25T09:00:00.000Z",
        }),
        makeSession({
            id: "s-c",
            device: "Safari on iPhone",
            current: false,
            lastUsedAt: "2026-10-24T09:00:00.000Z",
        }),
    ];

    it("revokes every other device one by one and keeps the current one", async () => {
        const seen = [];
        server.use(
            http.get(apiUrl("/auth/sessions"), () => okResponse(threeSessions)),
            http.delete(apiUrl("/auth/sessions/:id"), ({ params }) => {
                seen.push(params.id);
                return okResponse(null);
            })
        );
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const result = await store.dispatch(revokeOtherSessions());
        expect(seen.sort()).toEqual(["s-b", "s-c"]);
        expect(result.payload).toEqual({
            ids: expect.arrayContaining(["s-b", "s-c"]),
        });
        expect(
            selectAllSessions(store.getState()).map((item) => item.id)
        ).toEqual([makeSession().id]);
        expect(selectRevokeSessionOp(store.getState()).status).toBe(
            "succeeded"
        );
        expect(store.getState().auth.user).not.toBeNull();
    });

    it("stops at the first failure and keeps the list for the UI to reload", async () => {
        const seen = [];
        server.use(
            http.get(apiUrl("/auth/sessions"), () => okResponse(threeSessions)),
            http.delete(apiUrl("/auth/sessions/:id"), ({ params }) => {
                seen.push(params.id);
                return errorResponse(500, "INTERNAL");
            })
        );
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const result = await store.dispatch(revokeOtherSessions());
        expect(result.payload.code).toBe("INTERNAL");
        expect(seen).toHaveLength(1);
        expect(selectAllSessions(store.getState())).toHaveLength(3);
        expect(selectRevokeSessionOp(store.getState())).toMatchObject({
            status: "failed",
            error: { code: "INTERNAL" },
        });
    });

    it("is a successful no-op when there are no other devices", async () => {
        server.use(
            http.get(apiUrl("/auth/sessions"), () =>
                okResponse([makeSession()])
            )
        );
        const store = setupStore({ auth: signedInAuth() });
        await store.dispatch(fetchSessions());
        const result = await store.dispatch(revokeOtherSessions());
        expect(result.payload).toEqual({ ids: [] });
    });
});

describe("defensive reducers (actions without a payload)", () => {
    it("records an unknown failure for a fetch or revoke rejected without a payload", () => {
        const store = setupStore();
        store.dispatch(fetchSessions.rejected(new Error("boom"), "request-1"));
        expect(selectSessionsError(store.getState())).toMatchObject({
            code: "UNKNOWN",
        });
        store.dispatch(
            revokeSession.rejected(new Error("boom"), "request-2", { id: "s1" })
        );
        expect(selectRevokeSessionOp(store.getState())).toMatchObject({
            status: "failed",
            error: { code: "UNKNOWN" },
        });
    });
});
