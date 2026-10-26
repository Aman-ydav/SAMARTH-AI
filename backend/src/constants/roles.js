/** User roles (AUTH-59). No implicit hierarchy: `authorize` lists roles explicitly. */
export const ROLES = Object.freeze({
    LEARNER: "learner",
    TRAINER: "trainer",
    ADMIN: "admin",
    SUPERADMIN: "superadmin",
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

/** Roles an invite may grant: everything except superadmin (rule 05, invites). */
export const INVITABLE_ROLES = Object.freeze([
    ROLES.LEARNER,
    ROLES.TRAINER,
    ROLES.ADMIN,
]);
