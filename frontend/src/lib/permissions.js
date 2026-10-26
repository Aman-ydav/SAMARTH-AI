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
