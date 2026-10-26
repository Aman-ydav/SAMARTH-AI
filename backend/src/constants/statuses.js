/** Account, session, invite and media enums (DB-03): one frozen list each, reused by Mongoose, Zod and seeds. */
export const USER_STATUSES = Object.freeze({
    INVITED: "invited",
    PENDING_VERIFICATION: "pending_verification",
    ACTIVE: "active",
    SUSPENDED: "suspended",
    DEACTIVATED: "deactivated",
    PENDING_DELETION: "pending_deletion",
    DELETED: "deleted",
});
export const USER_STATUS_LIST = Object.freeze(Object.values(USER_STATUSES));

export const AUTH_PROVIDERS = Object.freeze({
    LOCAL: "local",
    GOOGLE: "google",
    SSO: "sso",
});
export const AUTH_PROVIDER_LIST = Object.freeze(Object.values(AUTH_PROVIDERS));

export const LOCALES = Object.freeze({ EN: "en", HI: "hi" });
export const LOCALE_LIST = Object.freeze(Object.values(LOCALES));

export const SESSION_REVOKED_REASONS = Object.freeze({
    LOGOUT: "logout",
    LOGOUT_ALL: "logout_all",
    ROTATED: "rotated",
    REUSE_DETECTED: "reuse_detected",
    PASSWORD_CHANGE: "password_change",
    ADMIN: "admin",
});
export const SESSION_REVOKED_REASON_LIST = Object.freeze(
    Object.values(SESSION_REVOKED_REASONS)
);

export const INVITE_STATUSES = Object.freeze({
    SENT: "sent",
    ACCEPTED: "accepted",
    REVOKED: "revoked",
    EXPIRED: "expired",
});
export const INVITE_STATUS_LIST = Object.freeze(Object.values(INVITE_STATUSES));

export const MEDIA_STATUSES = Object.freeze({
    PENDING: "pending",
    READY: "ready",
    DELETED: "deleted",
});
export const MEDIA_STATUS_LIST = Object.freeze(Object.values(MEDIA_STATUSES));
