import { apiClient } from "@/lib/apiClient";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";

/*
 * Admin endpoints (R69, backend/openapi.yaml `/admin/*`). Every function takes `(args, { signal })` and returns the unwrapped
 * data: `{ items, meta }` for the two lists, the single `invite` or `user` for the writes. Path ids are encoded (FE-39) and
 * only the query keys the API knows are sent.
 */

const withSignal = (signal, extra = {}) => ({ signal, ...extra });

export const INVITE_STATUSES = Object.freeze([
    "sent",
    "accepted",
    "revoked",
    "expired",
]);
export const USER_STATUSES = Object.freeze([
    "invited",
    "pending_verification",
    "active",
    "suspended",
    "deactivated",
    "pending_deletion",
    "deleted",
]);

/** Drops empty values so the URL stays minimal and the strict server schema never sees an empty filter. */
function cleanParams(params) {
    const clean = {};
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "")
            clean[key] = value;
    }
    return clean;
}

const text = (value) => (typeof value === "string" ? value : "");
const isoOrNull = (value) =>
    typeof value === "string" && value ? value : null;

/** Defensive read of one invitation (FE-37): unknown enums fall back to `unknown`, the token is never part of it. */
export function readInvite(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
        return null;
    return {
        id: raw.id,
        email: text(raw.email),
        role: text(raw.role),
        status: INVITE_STATUSES.includes(raw.status) ? raw.status : "unknown",
        resentCount: Number.isInteger(raw.resentCount) ? raw.resentCount : 0,
        expiresAt: isoOrNull(raw.expiresAt),
        acceptedAt: isoOrNull(raw.acceptedAt),
        createdAt: isoOrNull(raw.createdAt),
    };
}

/** Defensive read of one account in the admin view. */
export function readAdminUser(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
        return null;
    return {
        id: raw.id,
        email: text(raw.email),
        name: text(raw.name),
        role: text(raw.role),
        status: USER_STATUSES.includes(raw.status) ? raw.status : "unknown",
        emailVerified: raw.emailVerified === true,
        mustChangePassword: raw.mustChangePassword === true,
        lastLoginAt: isoOrNull(raw.lastLoginAt),
        createdAt: isoOrNull(raw.createdAt),
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

const readList = (items, read) =>
    (Array.isArray(items) ? items : []).map(read).filter(Boolean);

export async function listInvites(query, { signal } = {}) {
    const { data, meta } = await apiClient.get(
        "/admin/invites",
        withSignal(signal, { params: cleanParams(query) })
    );
    return {
        items: readList(data?.invites, readInvite),
        meta: readMeta(meta),
    };
}

export async function createInvite({ email, role }, { signal } = {}) {
    const { data } = await apiClient.post(
        "/admin/invites",
        { email, role },
        withSignal(signal)
    );
    return readInvite(data?.invite);
}

export async function revokeInvite({ id }, { signal } = {}) {
    const { data } = await apiClient.delete(
        `/admin/invites/${encodeURIComponent(id)}`,
        withSignal(signal)
    );
    return readInvite(data?.invite);
}

export async function resendInvite({ id }, { signal } = {}) {
    const { data } = await apiClient.post(
        `/admin/invites/${encodeURIComponent(id)}/resend`,
        null,
        withSignal(signal)
    );
    return readInvite(data?.invite);
}

export async function listUsers(query, { signal } = {}) {
    const { data, meta } = await apiClient.get(
        "/admin/users",
        withSignal(signal, { params: cleanParams(query) })
    );
    return {
        items: readList(data?.users, readAdminUser),
        meta: readMeta(meta),
    };
}

export async function setUserStatus({ id, status }, { signal } = {}) {
    const { data } = await apiClient.patch(
        `/admin/users/${encodeURIComponent(id)}/status`,
        { status },
        withSignal(signal)
    );
    return readAdminUser(data?.user);
}

export async function changeUserRole({ id, role }, { signal } = {}) {
    const { data } = await apiClient.patch(
        `/admin/users/${encodeURIComponent(id)}/role`,
        { role },
        withSignal(signal)
    );
    return readAdminUser(data?.user);
}

/** Rejection payload for a 2xx response that lacks the expected record (FE-37). */
export const invalidResponse = () =>
    toApiError({ statusCode: 200, code: API_ERROR_CODES.INVALID_RESPONSE });
