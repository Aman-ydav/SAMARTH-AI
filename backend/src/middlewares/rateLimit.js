import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";

/** Default tier settings (BE-61). The global tier is tuned with RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX; the others are fixed here. */
export const RATE_LIMIT_TIERS = Object.freeze({
    authSensitive: Object.freeze({ windowMs: 15 * 60 * 1000, limit: 10 }),
    ai: Object.freeze({ windowMs: 60 * 1000, limit: 20 }),
});

const UNLIMITED_PATHS = new Set(["/health", "/ready"]);

/**
 * Builds a limiter that answers 429 RATE_LIMITED through the central handler with `Retry-After` and `retryAfterSec`.
 *
 * - `ipScoped: true` (default): keyed by client IP and multiplied by RATE_LIMIT_IP_MULTIPLIER (R10; production forces 1).
 * - `ipScoped: false`: a per-account or per-user limit. NEVER multiplied: lockouts and per-email caps stay strict in tests.
 * - `key(req)`: custom key (for example the HMAC of a normalised email). It is prefixed with `name`.
 *
 * Each call owns its counters, so give every route group its own limiter.
 */
export function createLimiter({
    name,
    windowMs,
    limit,
    key,
    ipScoped = true,
    multiplier = env.rateLimit.ipMultiplier,
    skip,
}) {
    const effectiveLimit = ipScoped ? Math.ceil(limit * multiplier) : limit;
    return rateLimit({
        windowMs,
        limit: effectiveLimit,
        standardHeaders: "draft-6",
        legacyHeaders: false,
        skip,
        keyGenerator: key
            ? (req) => `${name}:${key(req)}`
            : (req) => `${name}:${ipKeyGenerator(req.ip ?? "")}`,
        handler(_req, res, next) {
            const retryAfterSec =
                Number(res.getHeader("Retry-After")) ||
                Math.ceil(windowMs / 1000);
            next(
                ApiError.tooManyRequests(ERROR_CODES.RATE_LIMITED, {
                    retryAfterSec,
                })
            );
        },
    });
}

/** Per-IP limiter for the whole app; `/health`, `/ready` and CORS preflights are never limited (BE-05, BE-14). */
export const globalLimiter = (config = env) =>
    createLimiter({
        name: "global",
        windowMs: config.rateLimit.windowMs,
        limit: config.rateLimit.max,
        multiplier: config.rateLimit.ipMultiplier,
        skip: (req) =>
            req.method === "OPTIONS" || UNLIMITED_PATHS.has(req.path),
    });

/** Strict per-IP limiter for login, register, forgot/reset, refresh and similar routes (override `limit`/`windowMs`/`key`). */
export const authSensitiveLimiter = (overrides = {}) =>
    createLimiter({
        name: "auth",
        ...RATE_LIMIT_TIERS.authSensitive,
        ...overrides,
    });

/** Limiter for expensive endpoints: AI calls, uploads, email-sending routes. */
export const aiLimiter = (overrides = {}) =>
    createLimiter({ name: "ai", ...RATE_LIMIT_TIERS.ai, ...overrides });
