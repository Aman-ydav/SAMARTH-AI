import { ROLES } from "#constants/roles.js";

// Admin-module constants (FS-14): rate limits, who may act on whom, and list whitelists.
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Per-user limits (never multiplied in tests, R10). Reads are generous, writes are strict. */
export const ADMIN_LIMITS = Object.freeze({
    read: { name: "admin-read", windowMs: 15 * MINUTE_MS, limit: 300 },
    invitesWrite: { name: "admin-invites-write", windowMs: HOUR_MS, limit: 30 },
    usersWrite: { name: "admin-users-write", windowMs: HOUR_MS, limit: 60 },
});

/** Roles that may open any `/admin` route at all. Learners and trainers get 403. */
export const ADMIN_AREA_ROLES = Object.freeze([ROLES.ADMIN, ROLES.SUPERADMIN]);

/**
 * Whose status an actor may change (suspend or reactivate), by the actor's role (R68). Nobody may touch a platform
 * admin (`superadmin`), and nobody may act on their own account.
 */
export const STATUS_TARGETS = Object.freeze({
    [ROLES.ADMIN]: Object.freeze([ROLES.LEARNER, ROLES.TRAINER]),
    [ROLES.SUPERADMIN]: Object.freeze([
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
    ]),
});

/** Roles `PATCH /admin/users/:id/role` can set. `superadmin` is never granted or taken away over HTTP. */
export const ASSIGNABLE_ROLES = Object.freeze([
    ROLES.LEARNER,
    ROLES.TRAINER,
    ROLES.ADMIN,
]);

export const USER_SORT_FIELDS = Object.freeze(["createdAt", "email", "name"]);

/** The email-prefix search (`q`) is capped so a request cannot build a huge pattern (EDGE-43). */
export const SEARCH_MAX_LENGTH = 64;
