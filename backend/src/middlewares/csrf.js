import { env } from "#config/env.js";
import { COOKIE_NAMES, CSRF_HEADER } from "#constants/cookieNames.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { CSRF_EXEMPT_ROUTES } from "#constants/http.js";
import { ApiError } from "#utils/apiError.js";
import { cookies } from "#utils/cookies.js";
import { randomToken, timingSafeEqual } from "#utils/hash.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,128}$/;
const csrfError = () => ApiError.forbidden(ERROR_CODES.CSRF_INVALID);

const pathOf = (req) =>
    (req.originalUrl ?? req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";

/**
 * Double-submit CSRF protection (AUTH-16..19, R27). Mount it first inside the `/api/v1` router.
 *
 * - Any response lacking a valid `sai_csrf` cookie gets a fresh one (so it exists before the first login POST).
 * - POST/PUT/PATCH/DELETE must send `X-CSRF-Token` equal to the cookie (constant-time compare), else 403 CSRF_INVALID.
 * - When an `Origin` header is present on an unsafe request it must be in the exact CORS allowlist.
 * - Exempt: safe methods and the routes in constants/http.js (signature-verified webhooks). Login/register are NOT exempt.
 * - `CSRF_ENABLED=false` (never allowed in production) turns the whole check off.
 */
export function csrfProtection({
    enabled = env.cookies.csrfEnabled,
    allowedOrigins = env.corsAllowedOrigins,
    exempt = CSRF_EXEMPT_ROUTES,
    cookieHelpers = cookies,
    generateToken = randomToken,
} = {}) {
    const origins = new Set(allowedOrigins);
    const isExempt = (req) =>
        exempt.some(
            (route) => route.method === req.method && route.path === pathOf(req)
        );

    return (req, res, next) => {
        if (!enabled) return next();

        const current = req.cookies?.[COOKIE_NAMES.CSRF];
        const hasValidCookie =
            typeof current === "string" && TOKEN_SHAPE.test(current);
        if (!hasValidCookie) cookieHelpers.setCsrfCookie(res, generateToken());

        if (SAFE_METHODS.has(req.method) || isExempt(req)) return next();

        const origin = req.headers.origin;
        if (origin !== undefined && !origins.has(origin))
            return next(csrfError());

        const submitted = req.get(CSRF_HEADER);
        // A cookie issued on this very response cannot match any header the client already sent.
        if (!hasValidCookie || !timingSafeEqual(submitted, current))
            return next(csrfError());
        return next();
    };
}
