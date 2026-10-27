import { http } from "msw";
import { describe, expect, it } from "vitest";
import * as adminApi from "@/features/admin/api/adminApi";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import {
    apiUrl,
    errorResponse,
    okResponse,
    pageMeta,
} from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";
import { setupMockServer } from "@/test/mockServerLifecycle";

const server = setupMockServer();

describe("readInvite", () => {
    it("keeps the fields the screen needs and never a token", () => {
        const invite = adminApi.readInvite({
            ...makeInvite(),
            token: "secret",
            tokenId: "x",
        });
        expect(invite).toEqual({
            id: "64b7f0c2a1b2c3d4e5f60201",
            email: "meera.nair@example.test",
            role: "trainer",
            status: "sent",
            resentCount: 0,
            expiresAt: "2026-11-03T09:00:00.000Z",
            acceptedAt: null,
            createdAt: "2026-10-27T09:00:00.000Z",
        });
        expect(JSON.stringify(invite)).not.toContain("secret");
    });

    it("gives an unknown status the neutral value and defaults missing parts", () => {
        const invite = adminApi.readInvite({ id: "i1", status: "weird" });
        expect(invite).toMatchObject({
            status: "unknown",
            email: "",
            role: "",
            resentCount: 0,
            expiresAt: null,
        });
    });

    it.each([undefined, null, {}, { id: 7 }, "x"])(
        "returns null for %j",
        (raw) => {
            expect(adminApi.readInvite(raw)).toBeNull();
        }
    );
});

describe("readAdminUser", () => {
    it("reads the admin view without any hash or counter", () => {
        const user = adminApi.readAdminUser({
            ...makeAdminUser(),
            passwordHash: "x",
            tokenVersion: 4,
        });
        expect(user).toEqual({
            id: "64b7f0c2a1b2c3d4e5f60301",
            email: "ravi.kumar@example.test",
            name: "Ravi Kumar",
            role: "learner",
            status: "active",
            emailVerified: true,
            mustChangePassword: false,
            lastLoginAt: "2026-10-26T09:00:00.000Z",
            createdAt: "2026-10-01T09:00:00.000Z",
        });
    });

    it("tolerates unknown statuses and missing optionals", () => {
        expect(adminApi.readAdminUser({ id: "u", status: "?" })).toMatchObject({
            status: "unknown",
            name: "",
            lastLoginAt: null,
            emailVerified: false,
        });
        expect(adminApi.readAdminUser(null)).toBeNull();
    });
});

describe("readMeta", () => {
    it("reads the page meta and defaults a broken one", () => {
        expect(
            adminApi.readMeta(pageMeta({ page: 2, limit: 10, total: 25 }))
        ).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
        expect(adminApi.readMeta(undefined)).toEqual({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
        });
        expect(adminApi.readMeta({ total: 41, limit: 20 }).totalPages).toBe(3);
    });
});

describe("invite requests", () => {
    it("lists invitations, sends only the filters that are set and returns items with meta", async () => {
        let search = null;
        server.use(
            http.get(apiUrl("/admin/invites"), ({ request }) => {
                search = new URL(request.url).searchParams;
                return okResponse(
                    { invites: [makeInvite(), null, { nope: 1 }] },
                    { meta: pageMeta({ total: 1 }) }
                );
            })
        );
        const result = await adminApi.listInvites({
            page: 2,
            limit: 20,
            status: undefined,
            sort: "",
        });
        expect(result.items).toHaveLength(1);
        expect(result.meta.total).toBe(1);
        expect(Object.fromEntries(search)).toEqual({ page: "2", limit: "20" });
    });

    it("creates an invitation with exactly email and role", async () => {
        let body = null;
        server.use(
            http.post(apiUrl("/admin/invites"), async ({ request }) => {
                body = await request.json();
                return okResponse(
                    { invite: makeInvite({ email: body.email }) },
                    { status: 201 }
                );
            })
        );
        const invite = await adminApi.createInvite({
            email: "a@example.test",
            role: "trainer",
            extra: "ignored",
        });
        expect(body).toEqual({ email: "a@example.test", role: "trainer" });
        expect(invite.email).toBe("a@example.test");
    });

    it("revokes and resends by an encoded id", async () => {
        const seen = [];
        server.use(
            http.delete(apiUrl("/admin/invites/:id"), ({ request }) => {
                seen.push(`DELETE ${new URL(request.url).pathname}`);
                return okResponse({
                    invite: makeInvite({ status: "revoked" }),
                });
            }),
            http.post(apiUrl("/admin/invites/:id/resend"), ({ request }) => {
                seen.push(`POST ${new URL(request.url).pathname}`);
                return okResponse({ invite: makeInvite({ resentCount: 2 }) });
            })
        );
        expect((await adminApi.revokeInvite({ id: "a/b" })).status).toBe(
            "revoked"
        );
        expect((await adminApi.resendInvite({ id: "i 1" })).resentCount).toBe(
            2
        );
        expect(seen).toEqual([
            "DELETE /api/v1/admin/invites/a%2Fb",
            "POST /api/v1/admin/invites/i%201/resend",
        ]);
    });

    it("rejects with the normalised error of the API", async () => {
        server.use(
            http.post(apiUrl("/admin/invites"), () =>
                errorResponse(409, "CONFLICT")
            )
        );
        await expect(
            adminApi.createInvite({ email: "a@example.test", role: "trainer" })
        ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("answers null when a write returns no invitation", async () => {
        server.use(
            http.delete(apiUrl("/admin/invites/:id"), () => okResponse({}))
        );
        expect(await adminApi.revokeInvite({ id: "i1" })).toBeNull();
    });
});

describe("user requests", () => {
    it("lists users with the search, role and status filters", async () => {
        let search = null;
        server.use(
            http.get(apiUrl("/admin/users"), ({ request }) => {
                search = new URL(request.url).searchParams;
                return okResponse(
                    { users: [makeAdminUser()] },
                    { meta: pageMeta({ total: 1 }) }
                );
            })
        );
        const result = await adminApi.listUsers({
            q: "ra",
            role: "learner",
            status: "active",
            page: 1,
        });
        expect(result.items[0].email).toBe("ravi.kumar@example.test");
        expect(Object.fromEntries(search)).toEqual({
            q: "ra",
            role: "learner",
            status: "active",
            page: "1",
        });
    });

    it("sets a status and a role with one key each", async () => {
        const bodies = [];
        server.use(
            http.patch(
                apiUrl("/admin/users/:id/status"),
                async ({ request }) => {
                    bodies.push(await request.json());
                    return okResponse({
                        user: makeAdminUser({ status: "suspended" }),
                    });
                }
            ),
            http.patch(apiUrl("/admin/users/:id/role"), async ({ request }) => {
                bodies.push(await request.json());
                return okResponse({ user: makeAdminUser({ role: "trainer" }) });
            })
        );
        expect(
            (await adminApi.setUserStatus({ id: "u1", status: "suspended" }))
                .status
        ).toBe("suspended");
        expect(
            (await adminApi.changeUserRole({ id: "u1", role: "trainer" })).role
        ).toBe("trainer");
        expect(bodies).toEqual([{ status: "suspended" }, { role: "trainer" }]);
    });

    it.each([
        [403, "SELF_ACTION_FORBIDDEN"],
        [404, "NOT_FOUND"],
        [409, "LAST_ADMIN"],
    ])("rejects a %s %s answer with its code", async (status, code) => {
        server.use(
            http.patch(apiUrl("/admin/users/:id/role"), () =>
                errorResponse(status, code)
            )
        );
        await expect(
            adminApi.changeUserRole({ id: "u1", role: "trainer" })
        ).rejects.toMatchObject({ statusCode: status, code });
    });
});

describe("invalidResponse", () => {
    it("is an INVALID_RESPONSE error payload", () => {
        expect(adminApi.invalidResponse()).toMatchObject({
            code: "INVALID_RESPONSE",
        });
    });
});
