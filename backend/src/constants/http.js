/** HTTP surface constants shared by middleware: paths, body limits, and the single CSRF exempt list (AUTH-18). */
export const API_PREFIX = "/api/v1";

/** Default JSON/urlencoded body limit (BE-09). */
export const BODY_LIMIT = "100kb";

/** Paths (under the API prefix) whose raw body is kept for signature verification (MEDIA-15). */
export const RAW_BODY_PATHS = Object.freeze([`${API_PREFIX}/media/webhook`]);

/**
 * The only routes that skip CSRF besides safe methods. Each needs a review note (AUTH-18).
 * Login, register and forgot-password are NOT exempt.
 */
export const CSRF_EXEMPT_ROUTES = Object.freeze([
    Object.freeze({
        method: "POST",
        path: `${API_PREFIX}/media/webhook`,
        reason: "Cloudinary webhook: verified by X-Cld-Signature, no browser cookies involved",
    }),
]);
