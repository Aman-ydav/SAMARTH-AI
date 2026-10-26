import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { logger as rootLogger } from "#utils/logger.js";

const SERVICE_DOWN = new Set([
    "MongoServerSelectionError",
    "MongooseServerSelectionError",
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
]);
const MULTER_FIELD_CODES = new Set([
    "LIMIT_FILE_COUNT",
    "LIMIT_FIELD_KEY",
    "LIMIT_FIELD_VALUE",
    "LIMIT_FIELD_COUNT",
    "LIMIT_UNEXPECTED_FILE",
    "LIMIT_PART_COUNT",
]);
const DB_RETRY_AFTER_SEC = 5;
const GENERIC_MESSAGE = "Something went wrong.";

const clip = (text) => String(text ?? "").slice(0, 200);
const fieldOf = (path) =>
    (Array.isArray(path) ? path.join(".") : String(path ?? "")) || undefined;
const entry = (field, message, code) => ({
    ...(field ? { field } : {}),
    message: clip(message),
    ...(code ? { code } : {}),
});

function fromZod(error) {
    const errors = error.issues.flatMap((issue) =>
        issue.code === "unrecognized_keys"
            ? issue.keys.map((key) =>
                  entry(
                      fieldOf([...issue.path, key]),
                      "Unknown field",
                      issue.code
                  )
              )
            : [entry(fieldOf(issue.path), issue.message, issue.code)]
    );
    return ApiError.validation(errors, { cause: error });
}

// Mongoose messages can embed submitted values, so only the path and the validator kind are used.
function fromMongooseValidation(error) {
    const errors = Object.values(error.errors ?? {}).map((item) => {
        const stable = /^[A-Z][A-Z0-9_]+$/.test(item.message)
            ? item.message
            : undefined;
        return entry(
            item.path,
            stable ?? (item.kind === "required" ? "Required" : "Invalid value"),
            stable ?? item.kind
        );
    });
    return ApiError.validation(errors, { cause: error });
}

function fromCast(error) {
    const field = error.path === "_id" ? "id" : error.path;
    if (error.kind === "ObjectId") {
        return ApiError.badRequest(ERROR_CODES.INVALID_ID, {
            errors: [
                entry(field, "Invalid identifier", ERROR_CODES.INVALID_ID),
            ],
            cause: error,
        });
    }
    return ApiError.validation([entry(field, "Invalid value", "cast")], {
        cause: error,
    });
}

function fromDuplicateKey(error) {
    const fields = Object.keys(error.keyPattern ?? error.keyValue ?? {});
    return ApiError.conflict(ERROR_CODES.CONFLICT, {
        errors: fields.map((field) =>
            entry(field, "Already exists", ERROR_CODES.CONFLICT)
        ),
        cause: error,
    });
}

function fromMulter(error) {
    if (error.code === "LIMIT_FILE_SIZE")
        return ApiError.fromCode(ERROR_CODES.FILE_TOO_LARGE, {
            errors: [entry(error.field, "File is too large")],
            cause: error,
        });
    const known = MULTER_FIELD_CODES.has(error.code);
    return ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
        errors: [
            entry(error.field, known ? "Unexpected upload" : "Invalid upload"),
        ],
        cause: error,
    });
}

function fromHttpError(error) {
    if (
        error.type === "entity.parse.failed" ||
        (error instanceof SyntaxError && error.status === 400)
    ) {
        return ApiError.badRequest(ERROR_CODES.INVALID_JSON, { cause: error });
    }
    if (
        error.type === "entity.too.large" ||
        error.type === "parameters.too.many" ||
        error.status === 413
    ) {
        return ApiError.fromCode(ERROR_CODES.PAYLOAD_TOO_LARGE, {
            cause: error,
        });
    }
    if (error.status === 415)
        return ApiError.fromCode(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, {
            cause: error,
        });
    return ApiError.badRequest(ERROR_CODES.BAD_REQUEST, { cause: error });
}

/** Maps any thrown value to an ApiError (rule 03 section 4). Unknown errors become a non-operational generic 500. */
export function toApiError(error) {
    if (error instanceof ApiError) return error;
    const name = error?.name;
    if (name === "ZodError" && Array.isArray(error.issues))
        return fromZod(error);
    if (name === "ValidationError" && error.errors)
        return fromMongooseValidation(error);
    if (name === "CastError") return fromCast(error);
    if (error?.code === 11000) return fromDuplicateKey(error);
    if (name === "VersionError")
        return ApiError.conflict(ERROR_CODES.CONFLICT, { cause: error });
    if (name === "TokenExpiredError")
        return ApiError.unauthorized(ERROR_CODES.TOKEN_EXPIRED, {
            cause: error,
        });
    if (name === "JsonWebTokenError" || name === "NotBeforeError")
        return ApiError.unauthorized(ERROR_CODES.TOKEN_INVALID, {
            cause: error,
        });
    if (name === "MulterError") return fromMulter(error);
    if (SERVICE_DOWN.has(name))
        return ApiError.serviceUnavailable(ERROR_CODES.INTEGRATION_ERROR, {
            retryAfterSec: DB_RETRY_AFTER_SEC,
            cause: error,
        });
    const httpStatus = error?.status ?? error?.statusCode;
    if (error instanceof URIError || (httpStatus >= 400 && httpStatus < 500))
        return fromHttpError(error);
    return ApiError.internal(ERROR_CODES.INTERNAL, {
        message: GENERIC_MESSAGE,
        isOperational: false,
        cause: error,
    });
}

/**
 * Central error handler, registered last (BE-30, BE-31). Emits the charter error envelope plus `requestId` (R35),
 * logs 5xx with the stack and 4xx as warnings without messages, and adds `stack` only in development.
 * Mongo, JWT and file-system details never reach the response.
 */
export function createErrorHandler({
    isDevelopment = env.isDevelopment,
    log = rootLogger,
} = {}) {
    // Express identifies error handlers by their four parameters.
    return function errorHandler(error, req, res, next) {
        if (res.headersSent) return next(error);
        const apiError = toApiError(error);
        const requestId = req.id ?? res.locals?.requestId;
        const logger = req.log ?? log;
        // The per-request logger already carries the request id; adding it again would duplicate the JSON key.
        const context = req.log ? {} : { requestId };

        if (apiError.statusCode >= 500) {
            logger.error(
                {
                    err: apiError.cause ?? error,
                    ...context,
                    code: apiError.code,
                    operational: apiError.isOperational,
                },
                "request failed"
            );
        } else {
            logger.warn(
                {
                    code: apiError.code,
                    statusCode: apiError.statusCode,
                    ...context,
                },
                "request rejected"
            );
        }

        const safeMessage = apiError.isOperational
            ? apiError.message
            : GENERIC_MESSAGE;
        const body = {
            statusCode: apiError.statusCode,
            success: false,
            message: safeMessage,
            code: apiError.isOperational ? apiError.code : ERROR_CODES.INTERNAL,
            errors: apiError.isOperational ? apiError.errors : [],
            data: null,
            requestId,
        };
        if (apiError.retryAfterSec !== undefined) {
            body.retryAfterSec = apiError.retryAfterSec;
            res.setHeader("Retry-After", String(apiError.retryAfterSec));
        }
        if (isDevelopment)
            body.stack = (apiError.cause ?? error)?.stack ?? apiError.stack;
        res.setHeader("Cache-Control", "no-store");
        return res.status(apiError.statusCode).json(body);
    };
}

export const errorHandler = createErrorHandler();
