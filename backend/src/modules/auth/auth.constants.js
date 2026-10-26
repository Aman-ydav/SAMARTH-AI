/** Auth-module constants (FS-14): limits, windows, neutral messages and frontend routes used in emailed links. */
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Lockout (AUTH-36): the 5th failure locks for 15 min, every further failure doubles it, never above 24 h. */
export const LOCKOUT = Object.freeze({
    THRESHOLD: 5,
    BASE_MS: 15 * MINUTE_MS,
    MAX_MS: DAY_MS,
    // A single IP failing this often, across any accounts, is locked out too.
    IP_THRESHOLD: 50,
});

export const MAX_ACTIVE_SESSIONS = 10; // AUTH-10
export const MAX_KNOWN_DEVICES = 20; // AUTH-39
export const DELETION_GRACE_MS = 30 * DAY_MS; // AUTH-56
export const POLICY_VERSION = "2026-10-26"; // stored with the consent timestamp (AUTH-28)

/** Resend and forgot caps that are enforced inside the service and answered silently (AUTH-30, AUTH-46). */
export const RESEND_VERIFICATION = Object.freeze({
    COOLDOWN_MS: MINUTE_MS,
    MAX_PER_HOUR: 5,
});
export const FORGOT_PASSWORD = Object.freeze({ MAX_PER_HOUR: 3 });
export { HOUR_MS };

/** Password policy numbers (AUTH-21, R4) and the number of past hashes that may not be reused (AUTH-25). */
export const PASSWORD_RULES = Object.freeze({
    MIN_LENGTH: 10,
    MAX_BYTES: 72,
    HISTORY_SIZE: 3,
});

/** Frontend routes used in emailed links (docs/23 section 2). Tokens are added as `#token=` by buildFrontendLink. */
export const FRONTEND_PATHS = Object.freeze({
    VERIFY_EMAIL: "/verify-email",
    RESET_PASSWORD: "/reset-password",
    ACCEPT_INVITE: "/accept-invite",
    CONFIRM_EMAIL_CHANGE: "/confirm-email-change",
    UNDO_EMAIL_CHANGE: "/undo-email-change",
    LOGIN: "/login",
    FORGOT_PASSWORD: "/forgot-password",
    ONBOARDING: "/onboarding",
    SECURITY: "/settings/security",
});

/**
 * Per-route rate limits (doc 08 section 3.1 and 10, AUTH-40). `scope` says what the counter is keyed by:
 * `ip` (multiplied by RATE_LIMIT_IP_MULTIPLIER in test:api), `email` or `user` (never relaxed).
 */
export const AUTH_LIMITS = Object.freeze({
    register: { name: "auth-register", windowMs: HOUR_MS, limit: 5 },
    verifyEmail: { name: "auth-verify", windowMs: HOUR_MS, limit: 10 },
    resendVerification: { name: "auth-resend", windowMs: DAY_MS, limit: 20 },
    loginIp: { name: "auth-login-ip", windowMs: 15 * MINUTE_MS, limit: 10 },
    loginEmail: {
        name: "auth-login-email",
        windowMs: 15 * MINUTE_MS,
        limit: 10,
    },
    google: { name: "auth-google", windowMs: 15 * MINUTE_MS, limit: 10 },
    refresh: { name: "auth-refresh", windowMs: 15 * MINUTE_MS, limit: 60 },
    forgotIp: { name: "auth-forgot-ip", windowMs: HOUR_MS, limit: 10 },
    reset: { name: "auth-reset", windowMs: HOUR_MS, limit: 10 },
    changePassword: {
        name: "auth-change-password",
        windowMs: HOUR_MS,
        limit: 10,
    },
    changeEmail: { name: "auth-change-email", windowMs: HOUR_MS, limit: 5 },
    changeEmailToken: {
        name: "auth-change-email-token",
        windowMs: HOUR_MS,
        limit: 10,
    },
    unlinkGoogle: { name: "auth-unlink-google", windowMs: HOUR_MS, limit: 10 },
    deleteAccount: { name: "auth-delete-account", windowMs: HOUR_MS, limit: 5 },
    acceptInvite: { name: "auth-accept-invite", windowMs: HOUR_MS, limit: 10 },
});

/** One fixed message per neutral answer (AUTH-27, AUTH-30, AUTH-46): identical for every account state. */
export const NEUTRAL_MESSAGES = Object.freeze({
    REGISTER:
        "If this email can be registered, we have sent you instructions. Check your inbox.",
    RESEND_VERIFICATION:
        "If this email is waiting for verification, we have sent a new link.",
    FORGOT_PASSWORD:
        "If an account exists for this email, we have sent password reset instructions.",
    CHANGE_EMAIL:
        "If the new address can be used, we have sent confirmation instructions.",
});
