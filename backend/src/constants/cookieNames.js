/** Fixed cookie names and the header that mirrors the CSRF cookie (charter section 4). */
export const COOKIE_NAMES = Object.freeze({
    ACCESS: "sai_access",
    REFRESH: "sai_refresh",
    CSRF: "sai_csrf",
});

export const CSRF_HEADER = "x-csrf-token";

/** `sai_refresh` is only sent to the auth routes (AUTH-02). */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";
