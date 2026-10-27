import { http } from "msw";
import { describe, expect, it } from "vitest";
import { resetApp } from "@/app/actions";
import { setupStore } from "@/app/store";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import {
    createInvite,
    fetchInvites,
    invitesInitialState,
    invitesOpCleared,
    resendInvite,
    revokeInvite,
    selectAllInvites,
    selectInviteById,
    selectInvitesError,
    selectInvitesLoadedKey,
    selectInvitesMeta,
    selectInvitesOp,
    selectInvitesStatus,
} from "@/features/admin/slice/invitesSlice";
import {
    apiUrl,
    errorResponse,
    okResponse,
    pageMeta,
} from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();
const query = { page: 1, limit: 20 };
const store = () => setupStore({ auth: signedInAuth({ role: "admin" }) });
const listOf = (invites, total = invites.length, extra = {}) =>
    http.get(apiUrl("/admin/invites"), () =>
        okResponse({ invites }, { meta: pageMeta({ total, ...extra }) })
    );

describe("fetchInvites", () => {
    it("starts empty and idle", () => {
        expect(store().getState().invites).toEqual(invitesInitialState);
        expect(invitesInitialState).toMatchObject({
            status: "idle",
            error: null,
            lastFetchedAt: null,
        });
    });

    it("loads one page with its meta, the key of the query and a timestamp", async () => {
        server.use(
            listOf(
                [
                    makeInvite(),
                    makeInvite({ id: "i2", email: "b@example.test" }),
                ],
                45,
                { page: 1, limit: 20 }
            )
        );
        const s = store();
        const pending = s.dispatch(fetchInvites(query));
        expect(selectInvitesStatus(s.getState())).toBe("loading");
        await pending;
        const state = s.getState();
        expect(selectAllInvites(state).map((invite) => invite.id)).toEqual([
            "64b7f0c2a1b2c3d4e5f60201",
            "i2",
        ]);
        expect(selectInvitesMeta(state)).toEqual({
            page: 1,
            limit: 20,
            total: 45,
            totalPages: 3,
        });
        expect(selectInvitesLoadedKey(state)).toBe(queryKeyOf(query));
        expect(state.invites.lastFetchedAt).toEqual(expect.any(Number));
        expect(selectInviteById(state, "i2").email).toBe("b@example.test");
        expect(selectInvitesStatus(state)).toBe("succeeded");
    });

    it("passes the status filter to the API and never the force flag", async () => {
        let search = null;
        server.use(
            http.get(apiUrl("/admin/invites"), ({ request }) => {
                search = new URL(request.url).searchParams;
                return okResponse({ invites: [] }, { meta: pageMeta() });
            })
        );
        await store().dispatch(
            fetchInvites({ ...query, status: "revoked", force: true })
        );
        expect(Object.fromEntries(search)).toEqual({
            page: "1",
            limit: "20",
            status: "revoked",
        });
    });

    it("skips a repeat of the same fresh query, but honours force and a new query", async () => {
        let calls = 0;
        server.use(
            http.get(apiUrl("/admin/invites"), () => {
                calls += 1;
                return okResponse({ invites: [] }, { meta: pageMeta() });
            })
        );
        const s = store();
        await s.dispatch(fetchInvites(query));
        await s.dispatch(fetchInvites(query));
        expect(calls).toBe(1);
        await s.dispatch(fetchInvites({ ...query, force: true }));
        expect(calls).toBe(2);
        await s.dispatch(fetchInvites({ ...query, page: 2 }));
        expect(calls).toBe(3);
    });

    it("does not start a second identical request while one is loading", async () => {
        let calls = 0;
        server.use(
            http.get(apiUrl("/admin/invites"), () => {
                calls += 1;
                return okResponse({ invites: [] }, { meta: pageMeta() });
            })
        );
        const s = store();
        await Promise.all([
            s.dispatch(fetchInvites(query)),
            s.dispatch(fetchInvites(query)),
            s.dispatch(fetchInvites({ ...query, force: true })),
        ]);
        expect(calls).toBe(1);
    });

    it("ignores an answer to an older query (out-of-order responses, FE-25)", async () => {
        const release = {};
        server.use(
            http.get(apiUrl("/admin/invites"), async ({ request }) => {
                const page = new URL(request.url).searchParams.get("page");
                if (page === "1")
                    await new Promise((resolve) => {
                        release.first = resolve;
                    });
                return okResponse(
                    { invites: [makeInvite({ id: `page-${page}` })] },
                    { meta: pageMeta({ page: Number(page), total: 60 }) }
                );
            })
        );
        const s = store();
        const first = s.dispatch(fetchInvites({ ...query, page: 1 }));
        await s.dispatch(fetchInvites({ ...query, page: 2 }));
        release.first();
        await first;
        expect(selectAllInvites(s.getState()).map((i) => i.id)).toEqual([
            "page-2",
        ]);
        expect(selectInvitesLoadedKey(s.getState())).toBe(
            queryKeyOf({ ...query, page: 2 })
        );
    });

    it("stores a normalised error and keeps old rows when a read fails", async () => {
        const s = store();
        server.use(listOf([makeInvite()]));
        await s.dispatch(fetchInvites(query));
        server.use(
            http.get(apiUrl("/admin/invites"), () =>
                errorResponse(500, "SERVER_ERROR", { requestId: "req-9" })
            )
        );
        await s.dispatch(fetchInvites({ ...query, force: true }));
        expect(selectInvitesStatus(s.getState())).toBe("failed");
        expect(selectInvitesError(s.getState())).toMatchObject({
            statusCode: 500,
            code: "SERVER_ERROR",
            requestId: "req-9",
        });
        expect(selectAllInvites(s.getState())).toHaveLength(1);
    });

    it("treats a cancelled read as no error", async () => {
        server.use(
            http.get(apiUrl("/admin/invites"), async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return okResponse({ invites: [] }, { meta: pageMeta() });
            })
        );
        const s = store();
        const pending = s.dispatch(fetchInvites(query));
        pending.abort();
        await pending;
        expect(selectInvitesStatus(s.getState())).toBe("idle");
        expect(selectInvitesError(s.getState())).toBeNull();
    });
});

describe("invitation writes", () => {
    it("create succeeds, records the op and marks the list stale without inserting a row", async () => {
        const s = store();
        server.use(listOf([makeInvite()]));
        await s.dispatch(fetchInvites(query));
        const invite = await s
            .dispatch(
                createInvite({ email: "c@example.test", role: "trainer" })
            )
            .unwrap();
        expect(invite).toMatchObject({
            email: "c@example.test",
            role: "trainer",
        });
        expect(selectAllInvites(s.getState())).toHaveLength(1);
        expect(s.getState().invites.lastFetchedAt).toBeNull();
        expect(selectInvitesOp(s.getState(), "createInvite")).toEqual({
            status: "succeeded",
            error: null,
        });
        // stale list: the same query now refetches without force
        let calls = 0;
        server.use(
            http.get(apiUrl("/admin/invites"), () => {
                calls += 1;
                return okResponse({ invites: [] }, { meta: pageMeta() });
            })
        );
        await s.dispatch(fetchInvites(query));
        expect(calls).toBe(1);
    });

    it("create rejects with a 409 CONFLICT payload and records the failure", async () => {
        server.use(
            http.post(apiUrl("/admin/invites"), () =>
                errorResponse(409, "CONFLICT")
            )
        );
        const s = store();
        const result = await s.dispatch(
            createInvite({ email: "c@example.test", role: "trainer" })
        );
        expect(result.payload).toMatchObject({
            statusCode: 409,
            code: "CONFLICT",
        });
        expect(selectInvitesOp(s.getState(), "createInvite")).toMatchObject({
            status: "failed",
            error: { code: "CONFLICT" },
        });
        s.dispatch(invitesOpCleared("createInvite"));
        expect(selectInvitesOp(s.getState(), "createInvite").status).toBe(
            "idle"
        );
    });

    it("revoke and resend replace the row with the answer", async () => {
        const s = store();
        server.use(listOf([makeInvite()]));
        await s.dispatch(fetchInvites(query));
        const id = "64b7f0c2a1b2c3d4e5f60201";
        await s.dispatch(resendInvite({ id })).unwrap();
        expect(selectInviteById(s.getState(), id).resentCount).toBe(1);
        await s.dispatch(revokeInvite({ id })).unwrap();
        expect(selectInviteById(s.getState(), id).status).toBe("revoked");
    });

    it("resend at the cap rejects with the 422 payload and leaves the row", async () => {
        server.use(
            http.post(apiUrl("/admin/invites/:id/resend"), () =>
                errorResponse(422, "UNPROCESSABLE")
            )
        );
        const s = store();
        server.use(listOf([makeInvite({ resentCount: 5 })]));
        await s.dispatch(fetchInvites(query));
        const result = await s.dispatch(
            resendInvite({ id: "64b7f0c2a1b2c3d4e5f60201" })
        );
        expect(result.payload).toMatchObject({
            statusCode: 422,
            code: "UNPROCESSABLE",
        });
        expect(
            selectInviteById(s.getState(), "64b7f0c2a1b2c3d4e5f60201")
                .resentCount
        ).toBe(5);
    });

    it("rejects a 2xx answer without an invitation as INVALID_RESPONSE", async () => {
        server.use(
            http.delete(apiUrl("/admin/invites/:id"), () => okResponse({}))
        );
        const result = await store().dispatch(revokeInvite({ id: "i1" }));
        expect(result.payload).toMatchObject({ code: "INVALID_RESPONSE" });
    });
});

describe("resetApp", () => {
    it("wipes the invitations on logout", async () => {
        const s = store();
        server.use(listOf([makeInvite()]));
        await s.dispatch(fetchInvites(query));
        s.dispatch(resetApp());
        expect(s.getState().invites).toEqual(invitesInitialState);
    });
});
