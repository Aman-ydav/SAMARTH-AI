/** Normalised failure shape used everywhere in the UI (FE-44). */
export const API_ERROR_CODES = Object.freeze({
    OFFLINE: "OFFLINE",
    NETWORK_ERROR: "NETWORK_ERROR",
    TIMEOUT: "TIMEOUT",
    REQUEST_CANCELED: "REQUEST_CANCELED",
    INVALID_RESPONSE: "INVALID_RESPONSE",
    UNKNOWN: "UNKNOWN",
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHENTICATED: "UNAUTHENTICATED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    SERVER_ERROR: "SERVER_ERROR",
    CSRF_INVALID: "CSRF_INVALID",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    TOKEN_INVALID: "TOKEN_INVALID",
    REFRESH_INVALID: "REFRESH_INVALID",
    SESSION_REVOKED: "SESSION_REVOKED",
    TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    MFA_REQUIRED: "MFA_REQUIRED",
    MUST_CHANGE_PASSWORD: "MUST_CHANGE_PASSWORD",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
    ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
    ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
    MAINTENANCE: "MAINTENANCE",
});

const STATUS_CODE_MAP = Object.freeze({
    400: API_ERROR_CODES.BAD_REQUEST,
    401: API_ERROR_CODES.UNAUTHENTICATED,
    403: API_ERROR_CODES.FORBIDDEN,
    404: API_ERROR_CODES.NOT_FOUND,
    409: API_ERROR_CODES.CONFLICT,
    413: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
    422: API_ERROR_CODES.VALIDATION_ERROR,
    429: API_ERROR_CODES.RATE_LIMITED,
});

/** Codes that end the session outright (FE-46, doc 20 section 9). */
export const SESSION_ENDING_CODES = Object.freeze([
    API_ERROR_CODES.REFRESH_INVALID,
    API_ERROR_CODES.SESSION_REVOKED,
    API_ERROR_CODES.TOKEN_REUSE_DETECTED,
]);

/** Codes for which a refresh is never attempted (FE-45). */
export const NO_REFRESH_CODES = Object.freeze([
    API_ERROR_CODES.INVALID_CREDENTIALS,
    API_ERROR_CODES.SESSION_REVOKED,
    API_ERROR_CODES.REFRESH_INVALID,
    API_ERROR_CODES.TOKEN_REUSE_DETECTED,
    API_ERROR_CODES.MFA_REQUIRED,
    API_ERROR_CODES.MUST_CHANGE_PASSWORD,
]);

/** Codes that mean "the access cookie is missing, expired or stale": one refresh may fix it. */
export const REFRESHABLE_CODES = Object.freeze([
    API_ERROR_CODES.TOKEN_EXPIRED,
    API_ERROR_CODES.AUTH_REQUIRED,
    API_ERROR_CODES.TOKEN_INVALID,
]);

export class ApiError extends Error {
    constructor({
        statusCode = 0,
        code = API_ERROR_CODES.UNKNOWN,
        message = "",
        errors = [],
        retryAfterSec = null,
        requestId = null,
    } = {}) {
        super(message || code);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
        this.retryAfterSec = retryAfterSec;
        this.requestId = requestId;
    }
}

export function codeForStatus(statusCode) {
    if (STATUS_CODE_MAP[statusCode]) return STATUS_CODE_MAP[statusCode];
    if (statusCode >= 500) return API_ERROR_CODES.SERVER_ERROR;
    if (statusCode >= 400) return API_ERROR_CODES.BAD_REQUEST;
    return API_ERROR_CODES.UNKNOWN;
}

/** Retry-After as delta seconds or an HTTP date; returns whole seconds or null. */
export function parseRetryAfter(value, now = Date.now()) {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value).trim();
    if (/^\d+$/.test(text)) return Number(text);
    const at = Date.parse(text);
    if (Number.isNaN(at)) return null;
    return Math.max(0, Math.ceil((at - now) / 1000));
}

function cleanErrors(list) {
    if (!Array.isArray(list)) return [];
    const result = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const entry = {
            message: typeof item.message === "string" ? item.message : "",
        };
        if (typeof item.field === "string") entry.field = item.field;
        if (typeof item.code === "string") entry.code = item.code;
        result.push(entry);
    }
    return result;
}

/** Retry delay from the body (top-level, meta, or an errors[] entry) when no header is present. */
export function retryAfterFromBody(body) {
    if (!body || typeof body !== "object") return null;
    const candidates = [body.retryAfterSec, body.meta?.retryAfterSec];
    if (Array.isArray(body.errors))
        candidates.push(...body.errors.map((item) => item?.retryAfterSec));
    for (const candidate of candidates) {
        if (
            typeof candidate === "number" &&
            Number.isFinite(candidate) &&
            candidate >= 0
        )
            return Math.ceil(candidate);
    }
    return null;
}

/** Builds a plain ApiError-shaped object from an HTTP status and an (already parsed) error body. */
export function apiErrorFromResponse(
    statusCode,
    body,
    { retryAfterHeader = null, requestIdHeader = null, now } = {}
) {
    const payload = body && typeof body === "object" ? body : {};
    const code =
        typeof payload.code === "string" && payload.code
            ? payload.code
            : codeForStatus(statusCode);
    return new ApiError({
        statusCode,
        code,
        message: typeof payload.message === "string" ? payload.message : "",
        errors: cleanErrors(payload.errors),
        retryAfterSec:
            parseRetryAfter(retryAfterHeader, now) ??
            retryAfterFromBody(payload),
        requestId:
            typeof payload.requestId === "string"
                ? payload.requestId
                : requestIdHeader || null,
    });
}

/**
 * Converts anything thrown into the plain serialisable ApiError shape, safe for Redux and rejectWithValue.
 * Unknown values become `UNKNOWN`; raw JS messages are never copied.
 */
export function toApiError(error) {
    if (
        error &&
        typeof error === "object" &&
        typeof error.code === "string" &&
        typeof error.statusCode === "number"
    ) {
        return {
            statusCode: error.statusCode,
            code: error.code,
            message: typeof error.message === "string" ? error.message : "",
            errors: cleanErrors(error.errors),
            retryAfterSec:
                typeof error.retryAfterSec === "number"
                    ? error.retryAfterSec
                    : null,
            requestId:
                typeof error.requestId === "string" ? error.requestId : null,
        };
    }
    return {
        statusCode: 0,
        code: API_ERROR_CODES.UNKNOWN,
        message: "",
        errors: [],
        retryAfterSec: null,
        requestId: null,
    };
}

export const isApiError = (value) =>
    Boolean(value) &&
    typeof value === "object" &&
    typeof value.code === "string" &&
    typeof value.statusCode === "number";

/** Cancelled work is never an error to show (FE-35). */
export const isCanceledError = (value) =>
    isApiError(value) && value.code === API_ERROR_CODES.REQUEST_CANCELED;

export const isSessionEndingError = (value) =>
    isApiError(value) && SESSION_ENDING_CODES.includes(value.code);

/** True for failures that say nothing about the session: the user stays signed in (FE-46). */
export const isTransientError = (value) =>
    isApiError(value) &&
    (value.statusCode === 0 ||
        value.statusCode >= 500 ||
        [
            API_ERROR_CODES.OFFLINE,
            API_ERROR_CODES.NETWORK_ERROR,
            API_ERROR_CODES.TIMEOUT,
        ].includes(value.code));

/** i18n key for an error code (FE-108); unknown codes resolve through the UNKNOWN fallback at the call site. */
export const errorMessageKey = (code) =>
    `errors:codes.${code || API_ERROR_CODES.UNKNOWN}`;
