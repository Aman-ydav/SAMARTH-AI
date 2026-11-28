import { z } from "zod";
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
} from "@/features/admin/schemas/adminSchemas";

/**
 * The audit actions the filter offers. Mirrors `backend/src/constants/auditActions.js`; the API refuses any other value, so
 * a name missing here only hides it from the dropdown. The names are technical identifiers, shown as they are.
 */
export const AUDIT_ACTIONS = Object.freeze([
    "USER_REGISTERED",
    "EMAIL_VERIFIED",
    "EMAIL_CHANGE_REQUESTED",
    "EMAIL_CHANGED",
    "EMAIL_CHANGE_UNDONE",
    "USER_SUSPENDED",
    "USER_REACTIVATED",
    "ACCOUNT_DEACTIVATED",
    "DELETION_REQUESTED",
    "DELETION_CANCELLED",
    "DELETION_COMPLETED",
    "DATA_EXPORTED",
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "LOGIN_NEW_DEVICE",
    "ACCOUNT_LOCKED",
    "PASSWORD_RESET_REQUESTED",
    "PASSWORD_RESET_COMPLETED",
    "PASSWORD_CHANGED",
    "GOOGLE_LINKED",
    "GOOGLE_UNLINKED",
    "SESSION_REVOKED",
    "LOGOUT_ALL",
    "TOKEN_REUSE_DETECTED",
    "ROLE_CHANGED",
    "INVITE_SENT",
    "INVITE_ACCEPTED",
    "INVITE_REVOKED",
    "INVITE_RESENT",
    "PLATFORM_ADMIN_CREATED",
    "ORGANISATION_CREATED",
    "ORGANISATION_UPDATED",
    "ORGANISATION_DEACTIVATED",
    "ORGANISATION_RESTORED",
    "USER_ORGANISATION_CHANGED",
]);

/* List parameters come from the URL, which is hostile input (FE-72): every value falls back to its default instead of failing.
   The API refuses a skip over 10 000, so with the largest page size page 100 is the deepest one it accepts. */
const page = z.coerce.number().int().min(1).max(100).catch(1);
const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE);
const instant = z.iso.datetime({ offset: true });

const querySchema = z.object({
    page,
    limit,
    action: z.enum(AUDIT_ACTIONS).optional().catch(undefined),
    from: instant.optional().catch(undefined),
    to: instant.optional().catch(undefined),
});

/** Audit list parameters from a `URLSearchParams`. A "from" after the "to" drops the "to", which the API would refuse. */
export function parseAuditQuery(params) {
    const query = querySchema.parse(
        Object.fromEntries(
            params instanceof URLSearchParams ? params.entries() : []
        )
    );
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to))
        return { ...query, to: undefined };
    return query;
}

const pad = (value) => String(value).padStart(2, "0");

/** ISO instant to the local `YYYY-MM-DDTHH:mm` a `datetime-local` input shows; empty for a missing or bad value. */
export function isoToLocalInput(iso) {
    const date = new Date(iso ?? "");
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** What a `datetime-local` input holds (local time) to the ISO instant the API wants; `undefined` when empty or invalid. */
export function localInputToIso(value) {
    if (typeof value !== "string" || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
