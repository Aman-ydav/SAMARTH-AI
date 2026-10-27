import { http } from "msw";
import { makeAdminUser } from "@/mocks/fixtures/adminUser";
import { apiUrl, okResponse, pageMeta } from "@/mocks/fixtures/envelope";
import { makeInvite } from "@/mocks/fixtures/invite";

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
            { invite: makeInvite({ email: body.email, role: body.role }) },
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
];
