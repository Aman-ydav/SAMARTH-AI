import { z } from "zod";
import { paginationQueryShape } from "#utils/pagination.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export const notificationIdParams = z.object({
    id: z.string().regex(OBJECT_ID_PATTERN),
});

/** `GET /me/notifications`: standard paging plus the unread filter. Unknown keys are refused by `validate` (BE-23). */
export const listNotificationsQuery = z.object({
    ...paginationQueryShape,
    unread: z.enum(["true", "false"]).optional(),
});

export const emptyQuery = z.object({});

/** The mark-read routes take no body; a body with any field is a 400, never silently ignored. */
export const emptyBody = z.object({});
