import { http } from "msw";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import { apiUrl, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";
import { makeOrganisation } from "@/mocks/fixtures/organisation";

/** Happy-path defaults for `/admin/invites` and `/admin/users` (R69). Tests override single routes with `server.use`. */
export const adminHandlers = [
    http.get(apiUrl("/admin/invites"), () =>
        okResponse(
            { invites: [makeInvite()] },
            { meta: pageMeta({ total: 1 }) }
        )
    ),
    http.post(apiUrl("/admin/invites"), async ({ request }) => {
        const body = await request.json();
        return okResponse(
            {
                invite: makeInvite({
                    email: body.email,
                    role: body.role,
                    organisationId:
                        body.organisationId ?? "000000000000000000000001",
                }),
            },
            { status: 201 }
        );
    }),
    http.delete(apiUrl("/admin/invites/:id"), ({ params }) =>
        okResponse({ invite: makeInvite({ id: params.id, status: "revoked" }) })
    ),
    http.post(apiUrl("/admin/invites/:id/resend"), ({ params }) =>
        okResponse({ invite: makeInvite({ id: params.id, resentCount: 1 }) })
    ),
    http.get(apiUrl("/admin/users"), () =>
        okResponse(
            { users: [makeAdminUser()] },
            { meta: pageMeta({ total: 1 }) }
        )
    ),
    http.patch(
        apiUrl("/admin/users/:id/organisation"),
        async ({ request, params }) => {
            const { organisationId } = await request.json();
            return okResponse({
                user: makeAdminUser({
                    id: params.id,
                    orgId: organisationId,
                }),
            });
        }
    ),
    http.patch(
        apiUrl("/admin/users/:id/status"),
        async ({ request, params }) => {
            const { status } = await request.json();
            return okResponse({
                user: makeAdminUser({ id: params.id, status }),
            });
        }
    ),
    http.patch(apiUrl("/admin/users/:id/role"), async ({ request, params }) => {
        const { role } = await request.json();
        return okResponse({ user: makeAdminUser({ id: params.id, role }) });
    }),
    http.get(apiUrl("/organisations"), () =>
        okResponse(
            { organisations: [makeOrganisation()] },
            { meta: pageMeta({ total: 1 }) }
        )
    ),
    http.post(apiUrl("/organisations"), async ({ request }) => {
        const body = await request.json();
        return okResponse(
            { organisation: makeOrganisation({ ...body, id: "org-created" }) },
            { status: 201 }
        );
    }),
    http.patch(
        apiUrl("/organisations/:id"),
        async ({ request, params }) => {
            const body = await request.json();
            return okResponse({
                organisation: makeOrganisation({ ...body, id: params.id }),
            });
        }
    ),
    http.delete(apiUrl("/organisations/:id"), ({ params }) =>
        okResponse({
            organisation: makeOrganisation({
                id: params.id,
                active: false,
            }),
        })
    ),
    http.post(apiUrl("/organisations/:id/restore"), ({ params }) =>
        okResponse({
            organisation: makeOrganisation({
                id: params.id,
                active: true,
            }),
        })
    ),
];
