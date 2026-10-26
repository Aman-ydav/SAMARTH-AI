/** Static CORS settings (BE-13, BE-14). The origin allowlist itself comes from CORS_ALLOWED_ORIGINS via config/env.js. */
export const CORS_METHODS = Object.freeze([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]);

export const CORS_ALLOWED_HEADERS = Object.freeze([
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Request-Id",
    "X-Requested-With",
]);

export const CORS_EXPOSED_HEADERS = Object.freeze([
    "X-Request-Id",
    "Retry-After",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "Content-Disposition",
]);

/** Preflight cache time in seconds (at most 600). */
export const CORS_MAX_AGE_SECONDS = 600;
