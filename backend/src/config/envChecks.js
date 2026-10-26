import {
    REFRESH_ABSOLUTE_CAP_MS,
    REFRESH_REMEMBER_ABSOLUTE_CAP_MS,
} from "#constants/tokenTypes.js";
import { parseDuration } from "#utils/dates.js";

// Field-level checks may have failed already; NaN keeps the comparisons below false instead of throwing.
const toMs = (value) => {
    try {
        return parseDuration(value);
    } catch {
        return Number.NaN;
    }
};

const ACCESS_TOKEN_MAX_MS = 15 * 60_000;

/**
 * Cross-field rules (token lifetimes, secrets, cookies, email, production guard rails).
 * Messages name variables, never values. The Cloudinary production checks live in env.js.
 */
export function crossChecks(env, ctx) {
    const fail = (path, message) =>
        ctx.addIssue({ code: "custom", path: [path], message });
    const production = env.NODE_ENV === "production";

    const secrets = [
        env.ACCESS_TOKEN_SECRET,
        env.REFRESH_TOKEN_SECRET,
        env.IDENTIFIER_HASH_SECRET,
    ];
    if (new Set(secrets).size < 3) {
        fail(
            "IDENTIFIER_HASH_SECRET",
            "ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET and IDENTIFIER_HASH_SECRET must all differ (R9)"
        );
    }
    if (toMs(env.ACCESS_TOKEN_EXPIRY) > ACCESS_TOKEN_MAX_MS) {
        fail("ACCESS_TOKEN_EXPIRY", "must not exceed 15m (charter section 4)");
    }
    if (toMs(env.REFRESH_TOKEN_EXPIRY) > REFRESH_ABSOLUTE_CAP_MS) {
        fail(
            "REFRESH_TOKEN_EXPIRY",
            "must not exceed the 30d absolute cap (R6)"
        );
    }
    if (
        toMs(env.REFRESH_TOKEN_REMEMBER_EXPIRY) >
        REFRESH_REMEMBER_ABSOLUTE_CAP_MS
    ) {
        fail(
            "REFRESH_TOKEN_REMEMBER_EXPIRY",
            "must not exceed the 90d absolute cap (R6)"
        );
    }
    if (
        toMs(env.REFRESH_TOKEN_REMEMBER_EXPIRY) < toMs(env.REFRESH_TOKEN_EXPIRY)
    ) {
        fail(
            "REFRESH_TOKEN_REMEMBER_EXPIRY",
            "must not be shorter than REFRESH_TOKEN_EXPIRY"
        );
    }
    if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_DOMAIN) {
        fail(
            "COOKIE_DOMAIN",
            "is required when COOKIE_SAMESITE=none: JS must be able to read sai_csrf (R13)"
        );
    }
    if (env.EMAIL_TRANSPORT === "brevo") {
        if (!env.BREVO_API_KEY) {
            fail("BREVO_API_KEY", "is required when EMAIL_TRANSPORT=brevo");
        }
        if (!env.EMAIL_FROM_ADDRESS) {
            fail(
                "EMAIL_FROM_ADDRESS",
                "is required when EMAIL_TRANSPORT=brevo (BE-71)"
            );
        }
    }
    if (env.LLM_PROVIDER !== "mock") {
        for (const name of ["LLM_MODEL_FAST", "LLM_MODEL_SMART"]) {
            if (!env[name]) {
                fail(name, "is required when LLM_PROVIDER is not mock (R14)");
            }
        }
    }
    if (production) productionChecks(env, fail);
}

function productionChecks(env, fail) {
    if (!env.EMAIL_TRANSPORT) {
        fail(
            "EMAIL_TRANSPORT",
            "must be set explicitly in production (log or brevo)"
        );
    }
    if (env.EMAIL_TRANSPORT === "memory") {
        fail("EMAIL_TRANSPORT", "memory is refused in production (TEST-42)");
    }
    if (!env.CSRF_ENABLED) fail("CSRF_ENABLED", "must be true in production");
    if (env.RATE_LIMIT_IP_MULTIPLIER !== 1) {
        fail("RATE_LIMIT_IP_MULTIPLIER", "must be 1 in production (R10)");
    }
    if (!env.FRONTEND_URL.startsWith("https://")) {
        fail("FRONTEND_URL", "must be https in production");
    }
    if (env.CORS_ALLOWED_ORIGINS.some((item) => !item.startsWith("https://"))) {
        fail(
            "CORS_ALLOWED_ORIGINS",
            "every origin must be https in production"
        );
    }
    if (env.ALLOW_GOOGLE_LOGIN && !env.GOOGLE_CLIENT_ID) {
        fail(
            "GOOGLE_CLIENT_ID",
            "is required in production when ALLOW_GOOGLE_LOGIN=true"
        );
    }
}
