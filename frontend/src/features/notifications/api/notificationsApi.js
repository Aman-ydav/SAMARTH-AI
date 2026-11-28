import { apiClient } from "@/lib/apiClient";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";

/*
 * In-app notifications (doc 08 section 6.3, doc 22). Every function takes `(args, { signal })` and returns unwrapped data:
 * `{ items, meta }` for the list, a number for the counts, the single record for mark-read (FE-39). The server stores no
 * text: the screens build it from `type` (see `useNotificationText`).
 */

const text = (value) => (typeof value === "string" ? value : "");
const textOrNull = (value) =>
    typeof value === "string" && value ? value : null;

/** Drops empty values so the URL stays minimal and the strict server schema never sees an empty filter. */
function cleanParams(params) {
    const clean = {};
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "")
            clean[key] = value;
    }
    return clean;
}

/** Defensive read of one notification (FE-37): an unknown `type` is kept as sent so the UI can show neutral wording. */
export function readNotification(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
        return null;
    return {
        id: raw.id,
        type: text(raw.type),
        subject: textOrNull(raw.subject),
        refId: textOrNull(raw.refId),
        link: textOrNull(raw.link),
        read: raw.read === true,
        readAt: textOrNull(raw.readAt),
        createdAt: textOrNull(raw.createdAt),
    };
}

/** Page meta with safe defaults (FE-26). */
export function readMeta(meta) {
    const page = Number.isInteger(meta?.page) && meta.page > 0 ? meta.page : 1;
    const limit =
        Number.isInteger(meta?.limit) && meta.limit > 0 ? meta.limit : 20;
    const total =
        Number.isInteger(meta?.total) && meta.total >= 0 ? meta.total : 0;
    const totalPages =
        Number.isInteger(meta?.totalPages) && meta.totalPages >= 0
            ? meta.totalPages
            : Math.ceil(total / limit);
    return { page, limit, total, totalPages };
}

const readList = (items) =>
    (Array.isArray(items) ? items : []).map(readNotification).filter(Boolean);

/** `GET /me/notifications`: newest first; `query` is `{ page, limit, unread }`. */
export async function list(query, { signal } = {}) {
    const { data, meta } = await apiClient.get("/me/notifications", {
        params: cleanParams(query),
        signal,
    });
    return { items: readList(data?.notifications), meta: readMeta(meta) };
}

/** `GET /me/notifications/unread-count`: a non-negative integer, or `null` when the response is not usable. */
export async function getUnreadCount({ signal } = {}) {
    const { data } = await apiClient.get("/me/notifications/unread-count", {
        signal,
    });
    return Number.isInteger(data?.unreadCount) && data.unreadCount >= 0
        ? data.unreadCount
        : null;
}

/** `POST /me/notifications/:id/read`: repeating it is harmless, the server returns the same record. */
export async function markRead({ id }, { signal } = {}) {
    const { data } = await apiClient.post(
        `/me/notifications/${encodeURIComponent(id)}/read`,
        {},
        { signal }
    );
    return readNotification(data?.notification);
}

/** `POST /me/notifications/read-all`: how many changed. */
export async function markAllRead({ signal } = {}) {
    const { data } = await apiClient.post(
        "/me/notifications/read-all",
        {},
        { signal }
    );
    return Number.isInteger(data?.updated) && data.updated >= 0
        ? data.updated
        : 0;
}

/** `DELETE /me/notifications/:id`: answers 204 with no body. */
export async function dismiss({ id }, { signal } = {}) {
    await apiClient.delete(`/me/notifications/${encodeURIComponent(id)}`, {
        signal,
    });
    return { id };
}

/** Rejection payload for a 2xx response that lacks the expected record (FE-37). */
export const invalidResponse = () =>
    toApiError({ statusCode: 200, code: API_ERROR_CODES.INVALID_RESPONSE });
