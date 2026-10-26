import { parseDuration } from "#utils/dates.js";

/**
 * Turns the validated flat environment (UPPER_SNAKE names) into the typed, grouped config object.
 * Cloudinary is added by env.js. Durations become milliseconds; lists become frozen arrays.
 */
export function shapeConfig(v) {
    const production = v.NODE_ENV === "production";
    const test = v.NODE_ENV === "test";
    return {
        nodeEnv: v.NODE_ENV,
        isProduction: production,
        isTest: test,
        isDevelopment: v.NODE_ENV === "development",
        port: v.PORT,
        frontendUrl: v.FRONTEND_URL,
        corsAllowedOrigins: Object.freeze([...v.CORS_ALLOWED_ORIGINS]),
        trustProxy: v.TRUST_PROXY ?? (production ? 1 : 0),
        logLevel: v.LOG_LEVEL,
        db: { uri: v.MONGODB_URI, name: v.MONGODB_DB_NAME },
        auth: {
            accessSecret: v.ACCESS_TOKEN_SECRET,
            accessExpiryMs: parseDuration(v.ACCESS_TOKEN_EXPIRY),
            refreshSecret: v.REFRESH_TOKEN_SECRET,
            refreshExpiryMs: parseDuration(v.REFRESH_TOKEN_EXPIRY),
            refreshRememberExpiryMs: parseDuration(
                v.REFRESH_TOKEN_REMEMBER_EXPIRY
            ),
            identifierHashSecret: v.IDENTIFIER_HASH_SECRET,
            allowSelfRegistration: v.ALLOW_SELF_REGISTRATION,
            allowedEmailDomains: Object.freeze([...v.ALLOWED_EMAIL_DOMAINS]),
            requireEmailVerification: v.REQUIRE_EMAIL_VERIFICATION,
            allowGoogleLogin: v.ALLOW_GOOGLE_LOGIN,
        },
        cookies: {
            domain: v.COOKIE_DOMAIN,
            sameSite: v.COOKIE_SAMESITE,
            secure: production || v.COOKIE_SAMESITE === "none",
            csrfEnabled: v.CSRF_ENABLED,
        },
        google: { clientId: v.GOOGLE_CLIENT_ID },
        email: {
            transport: v.EMAIL_TRANSPORT ?? (test ? "memory" : "log"),
            brevoApiKey: v.BREVO_API_KEY,
            fromAddress: v.EMAIL_FROM_ADDRESS ?? "no-reply@example.test",
            fromName: v.EMAIL_FROM_NAME,
            replyTo: v.EMAIL_REPLY_TO,
        },
        rateLimit: {
            windowMs: v.RATE_LIMIT_WINDOW_MS,
            max: v.RATE_LIMIT_MAX,
            ipMultiplier: v.RATE_LIMIT_IP_MULTIPLIER,
        },
        llm: {
            provider: v.LLM_PROVIDER,
            modelFast: v.LLM_MODEL_FAST ?? "mock",
            modelSmart: v.LLM_MODEL_SMART ?? "mock",
            timeoutMs: v.LLM_TIMEOUT_MS,
            dailyCapPerUser: v.LLM_DAILY_CAP_PER_USER,
            cacheTtlDays: v.LLM_CACHE_TTL_DAYS,
        },
        seed: {
            adminEmail: v.SEED_ADMIN_EMAIL,
            adminPassword: v.SEED_ADMIN_PASSWORD,
        },
    };
}
