import { HttpResponse, http } from "msw";
import { apiUrl, okResponse } from "@/mocks/fixtures/envelope";
import { makeNotification } from "@/mocks/fixtures/notification";

/**
 * Happy-path defaults for the in-app notification routes (doc 08 section 6.3): nothing to read, so every screen that
 * mounts the top bar gets an empty, valid answer instead of an unhandled request. Tests that need data override them.
 */
export const notificationsHandlers = [
    http.get(apiUrl("/me/notifications"), () =>
        okResponse(
            { notifications: [] },
            { meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }
        )
    ),
    http.get(apiUrl("/me/notifications/unread-count"), () =>
        okResponse({ unreadCount: 0 })
    ),
    http.post(apiUrl("/me/notifications/read-all"), () =>
        okResponse({ updated: 0 })
    ),
    http.post(apiUrl("/me/notifications/:id/read"), ({ params }) =>
        okResponse({
            notification: makeNotification({
                id: String(params.id),
                read: true,
                readAt: "2026-11-28T10:05:00.000Z",
            }),
        })
    ),
    http.delete(
        apiUrl("/me/notifications/:id"),
        () => new HttpResponse(null, { status: 204 })
    ),
];
