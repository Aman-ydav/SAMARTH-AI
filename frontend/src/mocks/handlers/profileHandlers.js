import { http } from "msw";
import { apiUrl, okResponse } from "@/mocks/fixtures/envelope";
import { makeUser } from "@/mocks/fixtures/user";

/** Happy-path defaults for `GET/PUT /profile` and `PUT/DELETE /me/avatar` (doc 08 sections 4 and 6). */
export const profileHandlers = [
    http.get(apiUrl("/profile"), () =>
        okResponse({ user: { ...makeUser(), timezone: "Asia/Kolkata" } })
    ),
    http.put(apiUrl("/profile"), async ({ request }) => {
        const patch = await request.json();
        return okResponse({
            user: { ...makeUser(), timezone: "Asia/Kolkata", ...patch },
        });
    }),
    http.put(apiUrl("/me/avatar"), () =>
        okResponse({
            user: makeUser({
                avatar: { publicId: "samarth-ai/test/avatars/a1", version: 1 },
            }),
        })
    ),
    http.delete(apiUrl("/me/avatar"), () =>
        okResponse({ user: makeUser({ avatar: null }) })
    ),
];
