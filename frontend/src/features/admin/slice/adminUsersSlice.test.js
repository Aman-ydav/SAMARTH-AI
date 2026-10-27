import { http } from "msw";
import { describe, expect, it } from "vitest";
import { resetApp } from "@/app/actions";
import { setupStore } from "@/app/store";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import {
    adminUsersInitialState,
    adminUsersOpCleared,
    fetchAdminUsers,
    selectAdminUserById,
    selectAdminUsersError,
    selectAdminUsersLoadedKey,
    selectAdminUsersMeta,
    selectAdminUsersOp,
    selectAdminUsersStatus,
    selectAllAdminUsers,
    updateUserRole,
    updateUserStatus,
} from "@/features/admin/slice/adminUsersSlice";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import {
    apiUrl,
    errorResponse,
    okResponse,
    pageMeta,
} from "@/mocks/fixtures/envelope";
import { signedInAuth } from "@/test/authState";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();
const query = { page: 1, limit: 20 };
const ID = "64b7f0c2a1b2c3d4e5f60301";
const store = () => setupStore({ auth: signedInAuth({ role: "superadmin" }) });
const listOf = (users, total = users.length) =>
    http.get(apiUrl("/admin/users"), () =>
        okResponse({ users }, { meta: pageMeta({ total }) })
    );

describe("fetchAdminUsers", () => {
    it("starts empty and idle", () => {
        expect(store().getState().adminUsers).toEqual(adminUsersInitialState);
    });

    it("loads a page, its meta and the key of the query", async () => {
        server.use(
            listOf(
                [makeAdminUser(), makeAdminUser({ id: "u2", name: "B" })],
                31
            )
        );
        const s = store();
        const pending = s.dispatch(fetchAdminUsers(query));
        expect(selectAdminUsersStatus(s.getState())).toBe("loading");
        await pending;
        const state = s.getState();
        expect(selectAllAdminUsers(state)).toHaveLength(2);
        expect(selectAdminUsersMeta(state)).toMatchObject({
            total: 31,
            totalPages: 2,
        });
        expect(selectAdminUsersLoadedKey(state)).toBe(queryKeyOf(query));
        expect(selectAdminUserById(state, "u2").name).toBe("B");
    });

    it("sends the search and filters, dedupes fresh repeats and honours force", async () => {
        const seen = [];
        server.use(
            http.get(apiUrl("/admin/users"), ({ request }) => {
                seen.push(
                    Object.fromEntries(new URL(request.url).searchParams)
                );
                return okResponse({ users: [] }, { meta: pageMeta() });
            })
        );
        const s = store();
        const filtered = {
            ...query,
            q: "ra",
            role: "trainer",
            status: "active",
        };
        await s.dispatch(fetchAdminUsers(filtered));
        await s.dispatch(fetchAdminUsers(filtered));
        await s.dispatch(fetchAdminUsers({ ...filtered, force: true }));
        expect(seen).toHaveLength(2);
        expect(seen[0]).toEqual({
            page: "1",
            limit: "20",
            q: "ra",
            role: "trainer",
            status: "active",
        });
    });

    it("ignores an older answer that arrives late (FE-25)", async () => {
        const release = {};
        server.use(
            http.get(apiUrl("/admin/users"), async ({ request }) => {
                const q = new URL(request.url).searchParams.get("q");
                if (q === "slow")
                    await new Promise((resolve) => {
                        release.slow = resolve;
                    });
                return okResponse(
                    { users: [makeAdminUser({ id: `for-${q}` })] },
                    { meta: pageMeta({ total: 1 }) }
                );
            })
        );
        const s = store();
        const slow = s.dispatch(fetchAdminUsers({ ...query, q: "slow" }));
        await s.dispatch(fetchAdminUsers({ ...query, q: "fast" }));
        release.slow();
        await slow;
        expect(selectAllAdminUsers(s.getState()).map((u) => u.id)).toEqual([
            "for-fast",
        ]);
    });

    it("keeps old rows and stores the error when a read fails; 403 is kept as is", async () => {
        const s = store();
        server.use(listOf([makeAdminUser()]));
        await s.dispatch(fetchAdminUsers(query));
        server.use(
            http.get(apiUrl("/admin/users"), () =>
                errorResponse(403, "FORBIDDEN")
            )
        );
        await s.dispatch(fetchAdminUsers({ ...query, force: true }));
        expect(selectAdminUsersStatus(s.getState())).toBe("failed");
        expect(selectAdminUsersError(s.getState())).toMatchObject({
            statusCode: 403,
            code: "FORBIDDEN",
        });
        expect(selectAllAdminUsers(s.getState())).toHaveLength(1);
    });
});

describe("account writes", () => {
    it("suspend and reactivate replace the row and record the op", async () => {
        const s = store();
        server.use(listOf([makeAdminUser()]));
        await s.dispatch(fetchAdminUsers(query));
        await s
            .dispatch(updateUserStatus({ id: ID, status: "suspended" }))
            .unwrap();
        expect(selectAdminUserById(s.getState(), ID).status).toBe("suspended");
        expect(selectAdminUsersOp(s.getState(), "updateUserStatus")).toEqual({
            status: "succeeded",
            error: null,
        });
        await s
            .dispatch(updateUserStatus({ id: ID, status: "active" }))
            .unwrap();
        expect(selectAdminUserById(s.getState(), ID).status).toBe("active");
    });

    it("a role change replaces the row", async () => {
        const s = store();
        server.use(listOf([makeAdminUser()]));
        await s.dispatch(fetchAdminUsers(query));
        await s.dispatch(updateUserRole({ id: ID, role: "trainer" })).unwrap();
        expect(selectAdminUserById(s.getState(), ID).role).toBe("trainer");
    });

    it.each([
        [403, "SELF_ACTION_FORBIDDEN"],
        [403, "FORBIDDEN"],
        [404, "NOT_FOUND"],
        [409, "CONFLICT"],
        [409, "LAST_ADMIN"],
        [429, "RATE_LIMITED"],
    ])(
        "a %s %s answer rejects with its code and leaves the row",
        async (status, code) => {
            server.use(
                http.patch(apiUrl("/admin/users/:id/role"), () =>
                    errorResponse(status, code)
                )
            );
            const s = store();
            server.use(listOf([makeAdminUser()]));
            await s.dispatch(fetchAdminUsers(query));
            const result = await s.dispatch(
                updateUserRole({ id: ID, role: "admin" })
            );
            expect(result.payload).toMatchObject({ statusCode: status, code });
            expect(selectAdminUserById(s.getState(), ID).role).toBe("learner");
            expect(
                selectAdminUsersOp(s.getState(), "updateUserRole")
            ).toMatchObject({
                status: "failed",
                error: { code },
            });
            s.dispatch(adminUsersOpCleared("updateUserRole"));
            expect(
                selectAdminUsersOp(s.getState(), "updateUserRole").status
            ).toBe("idle");
        }
    );

    it("rejects a 2xx answer without a user as INVALID_RESPONSE", async () => {
        server.use(
            http.patch(apiUrl("/admin/users/:id/status"), () => okResponse({}))
        );
        const result = await store().dispatch(
            updateUserStatus({ id: ID, status: "suspended" })
        );
        expect(result.payload).toMatchObject({ code: "INVALID_RESPONSE" });
    });
});

describe("resetApp", () => {
    it("wipes the accounts on logout", async () => {
        const s = store();
        server.use(listOf([makeAdminUser()]));
        await s.dispatch(fetchAdminUsers(query));
        s.dispatch(resetApp());
        expect(s.getState().adminUsers).toEqual(adminUsersInitialState);
    });
});
