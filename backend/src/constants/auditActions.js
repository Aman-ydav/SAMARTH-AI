/** Audit action registry (doc 20 section 14, AUTH-63). Starred events in the doc are proposed additions. */
const NAMES = [
    "USER_REGISTERED",
    "EMAIL_VERIFIED",
    "EMAIL_CHANGE_REQUESTED",
    "EMAIL_CHANGED",
    "EMAIL_CHANGE_UNDONE",
    "USER_SUSPENDED",
    "USER_REACTIVATED",
    "ACCOUNT_DEACTIVATED",
    "DELETION_REQUESTED",
    "DELETION_CANCELLED",
    "DELETION_COMPLETED",
    "DATA_EXPORTED",
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "LOGIN_NEW_DEVICE",
    "ACCOUNT_LOCKED",
    "PASSWORD_RESET_REQUESTED",
    "PASSWORD_RESET_COMPLETED",
    "PASSWORD_CHANGED",
    "GOOGLE_LINKED",
    "GOOGLE_UNLINKED",
    "SESSION_REVOKED",
    "LOGOUT_ALL",
    "TOKEN_REUSE_DETECTED",
    "ROLE_CHANGED",
    "INVITE_SENT",
    "INVITE_ACCEPTED",
];

/** `AUDIT_ACTIONS.LOGIN_SUCCESS === "LOGIN_SUCCESS"`. */
export const AUDIT_ACTIONS = Object.freeze(
    Object.fromEntries(NAMES.map((name) => [name, name]))
);

export const AUDIT_ACTION_LIST = Object.freeze([...NAMES]);
