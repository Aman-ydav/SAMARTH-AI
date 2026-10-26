import { ERROR_CATALOG, ERROR_CODES } from "#constants/errorCodes.js";

/**
 * Operational error with a stable `code`. Throw it from services and middleware; the central errorHandler renders it.
 * `errors[]` entries are `{ field?, message, code? }` and must never echo submitted values.
 */
export class ApiError extends Error {
    /**
     * @param {object} init
     * @param {number} init.statusCode HTTP status
     * @param {string} init.code stable UPPER_SNAKE code from constants/errorCodes.js
     * @param {string} [init.message] safe text (defaults to the catalogue message)
     * @param {Array<{field?: string, message: string, code?: string}>} [init.errors]
     * @param {unknown} [init.cause] underlying error, logged but never sent
     * @param {number} [init.retryAfterSec] sent as `Retry-After` and `retryAfterSec`
     * @param {boolean} [init.isOperational] false marks a programmer error (answered as a generic 500)
     */
    constructor({
        statusCode,
        code,
        message,
        errors = [],
        cause,
        retryAfterSec,
        isOperational = true,
    }) {
        super(
            message ??
                ERROR_CATALOG[code]?.message ??
                ERROR_CATALOG.INTERNAL.message,
            cause ? { cause } : undefined
        );
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
        this.isOperational = isOperational;
        if (retryAfterSec !== undefined) this.retryAfterSec = retryAfterSec;
        Error.captureStackTrace?.(this, ApiError);
    }

    /** Builds an error whose status comes from the catalogue (e.g. `fromCode(ERROR_CODES.ACCOUNT_LOCKED)` is 423). */
    static fromCode(code, options = {}) {
        const entry = ERROR_CATALOG[code];
        return new ApiError({
            statusCode: entry?.status ?? 500,
            code,
            ...options,
        });
    }

    static badRequest(code = ERROR_CODES.BAD_REQUEST, options = {}) {
        return new ApiError({ statusCode: 400, code, ...options });
    }

    /** 400 VALIDATION_ERROR with per-field entries. */
    static validation(errors = [], options = {}) {
        return new ApiError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            errors,
            ...options,
        });
    }

    static unauthorized(code = ERROR_CODES.AUTH_REQUIRED, options = {}) {
        return new ApiError({ statusCode: 401, code, ...options });
    }

    static forbidden(code = ERROR_CODES.FORBIDDEN, options = {}) {
        return new ApiError({ statusCode: 403, code, ...options });
    }

    static notFound(code = ERROR_CODES.NOT_FOUND, options = {}) {
        return new ApiError({ statusCode: 404, code, ...options });
    }

    static conflict(code = ERROR_CODES.CONFLICT, options = {}) {
        return new ApiError({ statusCode: 409, code, ...options });
    }

    static unprocessable(code = ERROR_CODES.UNPROCESSABLE, options = {}) {
        return new ApiError({ statusCode: 422, code, ...options });
    }

    /** 423 for locked accounts. Pass `retryAfterSec`. */
    static locked(code = ERROR_CODES.ACCOUNT_LOCKED, options = {}) {
        return new ApiError({ statusCode: 423, code, ...options });
    }

    static tooManyRequests(code = ERROR_CODES.RATE_LIMITED, options = {}) {
        return new ApiError({ statusCode: 429, code, ...options });
    }

    static internal(code = ERROR_CODES.INTERNAL, options = {}) {
        return new ApiError({ statusCode: 500, code, ...options });
    }

    /** 502 for a failed third party (Cloudinary, Brevo, Google): wrap the cause, never expose it (BE-46). */
    static badGateway(code = ERROR_CODES.INTEGRATION_ERROR, options = {}) {
        return new ApiError({ statusCode: 502, code, ...options });
    }

    /** 503 for an unavailable dependency (database down, AI unavailable). */
    static serviceUnavailable(
        code = ERROR_CODES.INTEGRATION_ERROR,
        options = {}
    ) {
        return new ApiError({ statusCode: 503, code, ...options });
    }
}
