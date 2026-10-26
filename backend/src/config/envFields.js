import { z } from "zod";
import { DB_NAME } from "#constants/dbName.js";
import { parseDuration } from "#utils/dates.js";

// Reusable field types for the environment schema. Keep messages free of configured values.
export const text = (schema = z.string()) => schema.trim();

export const flag = (fallback) =>
    z
        .enum(["true", "false"])
        .default(fallback ? "true" : "false")
        .transform((value) => value === "true");

const secret = z.string().min(32, "must be at least 32 characters");

const duration = z.string().refine((value) => {
    try {
        return parseDuration(value) > 0;
    } catch {
        return false;
    }
}, "must look like 15m, 7d or 30d");

const csv = (item, min = 0) =>
    z
        .string()
        .default("")
        .transform((value) =>
            value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
        )
        .pipe(z.array(item).min(min, "at least one entry is required"));

/** Strict origin: http(s) scheme + host (+ port), no path, no wildcard; one trailing slash is tolerated. */
const origin = z.string().transform((value, ctx) => {
    const cleaned = value.replace(/\/$/, "");
    let parsed;
    try {
        parsed = new URL(cleaned);
    } catch {
        ctx.addIssue({
            code: "custom",
            message: `"${value}" is not a valid origin`,
        });
        return z.NEVER;
    }
    if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.origin !== cleaned.toLowerCase()
    ) {
        ctx.addIssue({
            code: "custom",
            message: `"${value}" must be an http(s) origin without path, query or wildcard`,
        });
        return z.NEVER;
    }
    return parsed.origin;
});

const domain = z
    .string()
    .toLowerCase()
    .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
        "must be a domain"
    );

const port = z.coerce.number().int().min(1).max(65535);

/** Every variable except the Cloudinary ones (those live in env.js, MEDIA-03). */
export const envFields = {
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: port.default(8000),
    FRONTEND_URL: origin,
    CORS_ALLOWED_ORIGINS: csv(origin, 1),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),
    MONGODB_URI: z
        .string()
        .regex(
            /^mongodb(\+srv)?:\/\/\S+$/,
            "must be a mongodb:// or mongodb+srv:// URI"
        ),
    MONGODB_DB_NAME: text(z.string().min(1).max(63)).default(DB_NAME),
    ACCESS_TOKEN_SECRET: secret,
    ACCESS_TOKEN_EXPIRY: duration.default("15m"),
    REFRESH_TOKEN_SECRET: secret,
    REFRESH_TOKEN_EXPIRY: duration.default("7d"),
    REFRESH_TOKEN_REMEMBER_EXPIRY: duration.default("30d"),
    IDENTIFIER_HASH_SECRET: secret,
    COOKIE_DOMAIN: text(
        z.string().regex(/^\.?[a-z0-9.-]+$/i, "must be a bare domain")
    ).optional(),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    CSRF_ENABLED: flag(true),
    ALLOW_SELF_REGISTRATION: flag(true),
    ALLOWED_EMAIL_DOMAINS: csv(domain),
    REQUIRE_EMAIL_VERIFICATION: flag(true),
    ALLOW_GOOGLE_LOGIN: flag(true),
    GOOGLE_CLIENT_ID: text().optional(),
    EMAIL_TRANSPORT: z.enum(["log", "memory", "brevo"]).optional(),
    BREVO_API_KEY: text().optional(),
    EMAIL_FROM_ADDRESS: z.email().optional(),
    EMAIL_FROM_NAME: text(z.string().min(1).max(80)).default("SAMARTH AI"),
    EMAIL_REPLY_TO: z.email().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(86_400_000)
        .default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(100),
    RATE_LIMIT_IP_MULTIPLIER: z.coerce.number().min(1).max(1000).default(1),
    LLM_PROVIDER: z
        .enum(["mock", "anthropic", "gemini", "openai"])
        .default("mock"),
    LLM_MODEL_FAST: text().optional(),
    LLM_MODEL_SMART: text().optional(),
    LLM_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(300_000)
        .default(30_000),
    LLM_DAILY_CAP_PER_USER: z.coerce.number().int().min(1).default(200),
    LLM_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(7),
    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(10).max(72).optional(),
};
