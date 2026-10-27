/**
 * i18n keys of the four role names. `superadmin` is always shown as "Platform admin" (R68, R70); the stored value never
 * changes. Unknown roles fall back to the learner label so a label is never blank (FE-37).
 */
export const ROLE_LABEL_KEYS = Object.freeze({
    learner: "common:role.learner",
    trainer: "common:role.trainer",
    admin: "common:role.admin",
    superadmin: "common:role.superadmin",
});

export const roleLabelKey = (role) =>
    Object.hasOwn(ROLE_LABEL_KEYS, role)
        ? ROLE_LABEL_KEYS[role]
        : ROLE_LABEL_KEYS.learner;
