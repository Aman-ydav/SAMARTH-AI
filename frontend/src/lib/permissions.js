/** Client-side role checks are UX only; the server is the authority (FE-55). */
export const ROLES = Object.freeze({
    LEARNER: "learner",
    TRAINER: "trainer",
    ADMIN: "admin",
    SUPERADMIN: "superadmin",
});

const ROLE_VALUES = Object.values(ROLES);

/** Explicit role arrays for route guards: there is no implicit hierarchy (AUTH-60). */
export const ROLE_SETS = Object.freeze({
    all: Object.freeze([
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN,
    ]),
    learner: Object.freeze([
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN,
    ]),
    trainer: Object.freeze([ROLES.TRAINER, ROLES.ADMIN]),
    admin: Object.freeze([ROLES.ADMIN, ROLES.SUPERADMIN]),
    superadmin: Object.freeze([ROLES.SUPERADMIN]),
});

export const isKnownRole = (role) => ROLE_VALUES.includes(role);

/** True when the user holds one of the listed roles. Unknown or missing roles never match. */
export function hasRole(user, roles) {
    if (!user || !isKnownRole(user.role) || !Array.isArray(roles)) return false;
    return roles.includes(user.role);
}

export const isAdminRole = (user) => hasRole(user, ROLE_SETS.admin);

/*
 * Client mirrors of the admin rules (R68, R69, AUTH-61). They only decide what the UI offers; the server answers 403, 404
 * or 409 for anything else and the screens still map those answers (FE-55).
 */

/** Roles an inviter may grant: a platform admin invites trainers and admins, an admin trainers only, nobody else invites. */
export const INVITE_GRANTS = Object.freeze({
    [ROLES.SUPERADMIN]: Object.freeze([ROLES.TRAINER, ROLES.ADMIN]),
    [ROLES.ADMIN]: Object.freeze([ROLES.TRAINER]),
});

/** Whose status (suspend, reactivate) an actor may change. Nobody manages a platform admin or their own account. */
export const STATUS_TARGETS = Object.freeze({
    [ROLES.SUPERADMIN]: Object.freeze([
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
    ]),
    [ROLES.ADMIN]: Object.freeze([ROLES.LEARNER, ROLES.TRAINER]),
});

/** Roles a role change can set; `superadmin` is never granted or taken away in the app. */
export const ASSIGNABLE_ROLES = Object.freeze([
    ROLES.LEARNER,
    ROLES.TRAINER,
    ROLES.ADMIN,
]);

/** Roles that may change another person's role. */
export const ROLE_CHANGERS = Object.freeze([ROLES.SUPERADMIN]);

/** Roles the signed-in user may put in an invitation, in display order. Unknown or missing roles get none. */
export const grantableRoles = (user) =>
    user && isKnownRole(user.role) ? (INVITE_GRANTS[user.role] ?? []) : [];

const isSelf = (actor, target) => Boolean(actor?.id) && actor.id === target?.id;

/**
 * Which status action the actor may offer for a listed account: `suspend` for an active one, `reactivate` for a
 * suspended one, otherwise null (also null for yourself, a platform admin or a role outside the actor's reach).
 */
export function statusActionFor(actor, target) {
    if (!actor || !target || isSelf(actor, target)) return null;
    if (!STATUS_TARGETS[actor.role]?.includes(target.role)) return null;
    if (target.status === "active") return "suspend";
    if (target.status === "suspended") return "reactivate";
    return null;
}

/** Roles the actor may switch the target to (every assignable role except the current one); empty when not allowed. */
export function rolesChangeableTo(actor, target) {
    if (!actor || !target || isSelf(actor, target)) return [];
    if (!hasRole(actor, ROLE_CHANGERS)) return [];
    if (!ASSIGNABLE_ROLES.includes(target.role)) return [];
    return ASSIGNABLE_ROLES.filter((role) => role !== target.role);
}
