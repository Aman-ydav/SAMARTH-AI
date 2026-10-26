import cors from "cors";
import {
    CORS_ALLOWED_HEADERS,
    CORS_EXPOSED_HEADERS,
    CORS_MAX_AGE_SECONDS,
    CORS_METHODS,
} from "#config/cors.js";
import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";

/**
 * Exact-origin CORS with credentials (BE-11..16, AUTH-19). A request without an Origin header (curl, Postman, health checks)
 * passes because it carries no ambient browser cookies. A listed origin is echoed back exactly with `Vary: Origin`;
 * anything else becomes a 403 CORS_ORIGIN_DENIED through the central error handler. Preflight is answered with 204.
 */
export function corsMiddleware(allowedOrigins = env.corsAllowedOrigins) {
    const allowed = new Set(allowedOrigins);
    return cors({
        origin(origin, callback) {
            if (origin === undefined || allowed.has(origin))
                return callback(null, true);
            return callback(ApiError.forbidden(ERROR_CODES.CORS_ORIGIN_DENIED));
        },
        credentials: true,
        methods: [...CORS_METHODS],
        allowedHeaders: [...CORS_ALLOWED_HEADERS],
        exposedHeaders: [...CORS_EXPOSED_HEADERS],
        maxAge: CORS_MAX_AGE_SECONDS,
        optionsSuccessStatus: 204,
    });
}
