/**
 * Stable error-code catalogue (doc 08 section 9, doc 20 section 9, AUTH-64, rule 03 section 4).
 * Each entry: default HTTP status plus a safe, generic default message. Codes are API contract: never rename.
 */
const CATALOG = {
    // 400
    VALIDATION_ERROR: [400, "The request contains invalid data."],
    BAD_REQUEST: [400, "The request could not be processed."],
    INVALID_ID: [400, "The identifier is not valid."],
    INVALID_JSON: [400, "The request body is not valid JSON."],
    UPLOAD_INVALID: [400, "The upload is not valid."],
    PASSWORD_POLICY: [400, "The password does not meet the policy."],
    PASSWORD_REUSED: [400, "The new password was used recently."],
    VERIFY_TOKEN_INVALID: [
        400,
        "The verification link is invalid or has expired.",
    ],
    RESET_TOKEN_INVALID: [400, "The reset link is invalid or has expired."],
    INVITE_INVALID: [400, "The invitation is invalid or has expired."],
    EMAIL_CHANGE_INVALID: [
        400,
        "The email change link is invalid or has expired.",
    ],
    WEBHOOK_SIGNATURE_INVALID: [400, "The webhook signature is invalid."],
    MEDIA_TYPE_NOT_ALLOWED: [400, "This file type is not allowed."],
    // 401
    INVALID_CREDENTIALS: [401, "The email or password is incorrect."],
    AUTH_REQUIRED: [401, "Authentication is required."],
    TOKEN_EXPIRED: [401, "The access token has expired."],
    TOKEN_INVALID: [401, "The access token is not valid."],
    REFRESH_INVALID: [401, "The session cannot be refreshed."],
    SESSION_REVOKED: [401, "The session has been revoked."],
    TOKEN_REUSE_DETECTED: [401, "The session was ended for security reasons."],
    GOOGLE_TOKEN_INVALID: [401, "The Google credential could not be verified."],
    GOOGLE_EMAIL_UNVERIFIED: [401, "The Google account email is not verified."],
    MFA_REQUIRED: [401, "A second factor is required."],
    MFA_INVALID: [401, "The second factor is not valid."],
    // 403
    FORBIDDEN: [403, "You do not have permission to do this."],
    CSRF_INVALID: [403, "The request could not be verified."],
    CORS_ORIGIN_DENIED: [403, "This origin is not allowed."],
    REAUTH_REQUIRED: [403, "Please confirm your identity again."],
    DOMAIN_NOT_ALLOWED: [403, "This email domain is not allowed."],
    EMAIL_NOT_VERIFIED: [403, "The email address is not verified."],
    ACCOUNT_SUSPENDED: [403, "The account is suspended."],
    ACCOUNT_DEACTIVATED: [403, "The account is deactivated."],
    ACCOUNT_PENDING_DELETION: [403, "The account is scheduled for deletion."],
    MUST_CHANGE_PASSWORD: [403, "The password must be changed first."],
    // 404
    NOT_FOUND: [404, "The resource was not found."],
    MEDIA_NOT_FOUND: [404, "The media item was not found."],
    // 409
    CONFLICT: [
        409,
        "The resource already exists or is in a conflicting state.",
    ],
    LAST_ADMIN: [409, "This would remove the last active administrator."],
    AUTH_METHOD_REQUIRED: [409, "At least one sign-in method must remain."],
    // 413 / 415 / 422 / 423 / 429
    PAYLOAD_TOO_LARGE: [413, "The request body is too large."],
    FILE_TOO_LARGE: [413, "The file is too large."],
    MEDIA_TOO_LARGE: [413, "The media file is too large."],
    UNSUPPORTED_MEDIA_TYPE: [415, "The request content type is not supported."],
    UNPROCESSABLE: [
        422,
        "The request cannot be processed in the current state.",
    ],
    ACCOUNT_LOCKED: [423, "The account is temporarily locked."],
    RATE_LIMITED: [429, "Too many requests. Please try again later."],
    // 5xx
    INTERNAL: [500, "Something went wrong."],
    INTEGRATION_ERROR: [502, "An upstream service failed."],
    MEDIA_UPLOAD_FAILED: [502, "The media upload failed."],
    AI_UNAVAILABLE: [503, "The AI service is unavailable."],
};

/** `ERROR_CODES.FORBIDDEN === "FORBIDDEN"`: use instead of string literals. */
export const ERROR_CODES = Object.freeze(
    Object.fromEntries(Object.keys(CATALOG).map((code) => [code, code]))
);

export const ERROR_CODE_LIST = Object.freeze(Object.keys(CATALOG));

/** `{ CODE: { status, message } }` default status and generic message per code. */
export const ERROR_CATALOG = Object.freeze(
    Object.fromEntries(
        Object.entries(CATALOG).map(([code, [status, message]]) => [
            code,
            Object.freeze({ status, message }),
        ])
    )
);
