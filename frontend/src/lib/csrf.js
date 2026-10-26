const CSRF_COOKIE_NAME = "sai_csrf";

function readCookieString() {
    if (typeof document === "undefined") return "";
    try {
        return document.cookie || "";
    } catch {
        return "";
    }
}

/**
 * Reads the double-submit CSRF value from the JS-readable cookie (FE-41).
 * This is the only module allowed to touch document.cookie, and it never writes.
 */
export function getCsrfToken() {
    for (const part of readCookieString().split(";")) {
        const index = part.indexOf("=");
        if (index === -1) continue;
        if (part.slice(0, index).trim() !== CSRF_COOKIE_NAME) continue;
        const value = part.slice(index + 1).trim();
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
    return "";
}

export { CSRF_COOKIE_NAME };
