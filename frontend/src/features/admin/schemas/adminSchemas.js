import { z } from "zod";
import { emailField } from "@/features/auth";
import { ASSIGNABLE_ROLES, INVITE_GRANTS } from "@/lib/permissions";
import { INVITE_STATUSES, USER_STATUSES } from "@/features/admin/api/adminApi";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const SEARCH_MAX_LENGTH = 64;

const MESSAGES = {
    roleRequired: "admin:invites.form.roleRequired",
    roleInvalid: "admin:users.roleDialog.roleRequired",
};

/**
 * Invite form for one signed-in role: the email as the API wants it (trimmed, lowercased, at most 254 characters) and a
 * role that is one of the roles this person may grant (R68). A role outside the list fails here and, if forced, at the API.
 */
export const makeInviteSchema = (allowedRoles) =>
    z.object({
        email: emailField,
        role: z
            .string(MESSAGES.roleRequired)
            .refine(
                (role) => allowedRoles.includes(role),
                MESSAGES.roleRequired
            ),
    });

const INVITE_SCHEMAS = Object.freeze(
    Object.fromEntries(
        Object.entries(INVITE_GRANTS).map(([role, granted]) => [
            role,
            makeInviteSchema(granted),
        ])
    )
);

/** The invite schema for the signed-in role; a role that may not invite gets a schema that accepts no role. */
export const inviteSchemaFor = (actorRole) =>
    INVITE_SCHEMAS[actorRole] ?? makeInviteSchema([]);

/** The role-change dialog: one of the three assignable roles (never `superadmin`). */
export const changeRoleSchema = z.object({
    role: z.enum(ASSIGNABLE_ROLES, MESSAGES.roleInvalid),
});

/* List parameters come from the URL, which is hostile input (FE-72): every value falls back to its default instead of failing. */
const page = z.coerce.number().int().min(1).max(100000).catch(1);
const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE);

const invitesQuerySchema = z.object({
    page,
    limit,
    status: z.enum(INVITE_STATUSES).optional().catch(undefined),
});

const usersQuerySchema = z.object({
    page,
    limit,
    q: z
        .string()
        .trim()
        // eslint-disable-next-line no-control-regex -- reject control characters in the typed search, like the API does (EDGE-12)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value))
        .transform((value) => value.slice(0, SEARCH_MAX_LENGTH))
        .optional()
        .catch(undefined),
    role: z
        .enum(["learner", "trainer", "admin", "superadmin"])
        .optional()
        .catch(undefined),
    status: z.enum(USER_STATUSES).optional().catch(undefined),
});

const entries = (params) =>
    Object.fromEntries(
        params instanceof URLSearchParams ? params.entries() : []
    );

/** Invitation list parameters from a `URLSearchParams`, with defaults and clamps. */
export const parseInvitesQuery = (params) =>
    invitesQuerySchema.parse(entries(params));

/** Account list parameters from a `URLSearchParams`, with defaults and clamps. */
export const parseUsersQuery = (params) =>
    usersQuerySchema.parse(entries(params));

/** Stable cache key of a parsed query (FE-25). */
export const queryKeyOf = (query) =>
    JSON.stringify(
        Object.keys(query)
            .sort()
            .map((key) => [key, query[key] ?? null])
    );
