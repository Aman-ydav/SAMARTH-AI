/** Email template keys (doc 20 section 11). Use these constants, never string literals, when calling enqueueEmail. */
export const EMAIL_TEMPLATES = Object.freeze({
    VERIFY_EMAIL: "verify-email",
    WELCOME: "welcome",
    ALREADY_REGISTERED: "already-registered",
    PASSWORD_RESET: "password-reset",
    PASSWORD_CHANGED: "password-changed",
    NEW_DEVICE: "new-device",
    EMAIL_CHANGE_CONFIRM: "email-change-confirm",
    EMAIL_CHANGE_NOTICE: "email-change-notice",
    INVITE: "invite",
    ACCOUNT_LOCKED: "account-locked",
    ACCOUNT_DELETED: "account-deleted",
    GOOGLE_LINKED: "google-linked",
    TOKEN_REUSE_ALERT: "token-reuse-alert",
    DEACTIVATION_CONFIRM: "deactivation-confirm",
    DELETION_SCHEDULED: "deletion-scheduled",
});

export const EMAIL_TEMPLATE_LIST = Object.freeze(
    Object.values(EMAIL_TEMPLATES)
);

/** `password-reset` variants (AUTH-48): the active account gets a plain link, the others get an extra line. */
export const PASSWORD_RESET_VARIANTS = Object.freeze({
    ACTIVE: "active",
    GOOGLE_ONLY: "google_only",
    UNVERIFIED: "unverified",
    SETUP: "setup",
});
