import { env } from "#config/env.js";

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-_/]*$/;
const FORBIDDEN_PARAM = /token|jwt|secret|password|credential|session/i;

/**
 * Builds an emailed link from FRONTEND_URL only, never from the Host header (AUTH-31). A one-time token goes in the URL
 * fragment (`#token=...`) so it is not sent to servers, proxies or Referer headers (R2); it is never a query parameter.
 * @param {string} path frontend route such as "/verify-email"
 * @param {{ token?: string, params?: Record<string, string|number> }} [options]
 */
export function buildFrontendLink(
    path,
    { token, params } = {},
    baseUrl = env.frontendUrl
) {
    if (!SAFE_PATH.test(path)) throw new TypeError(`Unsafe link path: ${path}`);
    const base = new URL(baseUrl);
    const url = new URL(path, base);
    if (url.origin !== base.origin)
        throw new TypeError("Link would leave the frontend origin");
    for (const [key, value] of Object.entries(params ?? {})) {
        if (FORBIDDEN_PARAM.test(key))
            throw new TypeError(
                `Parameter "${key}" must not appear in a query string`
            );
        url.searchParams.set(key, String(value));
    }
    if (token) url.hash = `token=${encodeURIComponent(token)}`;
    return url.toString();
}

/** True when `value` is an absolute URL on the frontend origin. Templates refuse any other link. */
export function isFrontendLink(value, baseUrl = env.frontendUrl) {
    try {
        return new URL(value).origin === new URL(baseUrl).origin;
    } catch {
        return false;
    }
}

/** Reads the `token` from a link's fragment; returns null when there is none. */
export function readFragmentToken(link) {
    try {
        return new URLSearchParams(new URL(link).hash.slice(1)).get("token");
    } catch {
        return null;
    }
}
