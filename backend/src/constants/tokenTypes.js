/** One-time token types (R8: `authTokens.type` stays at four values) and their fixed lifetimes (R1). */
export const AUTH_TOKEN_TYPES = Object.freeze({
    EMAIL_VERIFY: "emailVerify",
    PASSWORD_RESET: "passwordReset",
    INVITE: "invite",
    EMAIL_CHANGE: "emailChange",
});
export const AUTH_TOKEN_TYPE_LIST = Object.freeze(
    Object.values(AUTH_TOKEN_TYPES)
);

/** `meta.kind` for emailChange tokens (R8). */
export const EMAIL_CHANGE_KINDS = Object.freeze({
    CONFIRM: "confirm",
    UNDO: "undo",
});

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const AUTH_TOKEN_TTL_MS = Object.freeze({
    [AUTH_TOKEN_TYPES.EMAIL_VERIFY]: 24 * HOUR_MS,
    [AUTH_TOKEN_TYPES.PASSWORD_RESET]: 30 * MINUTE_MS,
    [AUTH_TOKEN_TYPES.INVITE]: 7 * DAY_MS,
    [AUTH_TOKEN_TYPES.EMAIL_CHANGE]: 24 * HOUR_MS,
});

/** Refresh-session absolute caps counted from the first session row of a family (R6). */
export const REFRESH_ABSOLUTE_CAP_MS = 30 * DAY_MS;
export const REFRESH_REMEMBER_ABSOLUTE_CAP_MS = 90 * DAY_MS;

/** Grace window for multi-tab refresh races (AUTH-08). */
export const REFRESH_GRACE_MS = 10 * 1000;

/** Rows survive this long after `expiresAt` (R7). */
export const SESSION_TTL_GRACE_SECONDS = 30 * 24 * 60 * 60;

/** bcrypt cost, set once (AUTH-20). */
export const BCRYPT_COST = 12;
