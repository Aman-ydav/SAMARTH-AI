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

/**
 * Who may invite whom (R68). Trainers and admins are created only by invite; a platform admin (`superadmin`) may invite
 * trainers and admins, an admin may invite trainers only, learners and trainers invite nobody, and `superadmin` is
 * never invitable (it comes from PLATFORM_ADMINS). Learners register themselves, so they are not invitable here either.
 */
export const INVITE_GRANTS = Object.freeze({
    [ROLES.SUPERADMIN]: Object.freeze([ROLES.TRAINER, ROLES.ADMIN]),
    [ROLES.ADMIN]: Object.freeze([ROLES.TRAINER]),
});

/** Roles that can appear in an `POST /admin/invites` body. */
export const INVITE_BODY_ROLES = Object.freeze([ROLES.TRAINER, ROLES.ADMIN]);

/** User-facing names (the internal value of the platform admin stays `superadmin`). */
export const ROLE_LABELS = Object.freeze({
    [ROLES.LEARNER]: "Learner",
    [ROLES.TRAINER]: "Trainer",
    [ROLES.ADMIN]: "Admin",
    [ROLES.SUPERADMIN]: "Platform admin",
});
