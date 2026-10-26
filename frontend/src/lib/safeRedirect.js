import { DEFAULT_HOME_PATH, isReturnablePath } from "@/lib/paths";

const ENCODED_DANGER = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;
const LINE_SEPARATORS = [0x2028, 0x2029];

function hasControlChars(value) {
    for (const char of value) {
        const code = char.codePointAt(0);
        if (
            code <= 0x1f ||
            (code >= 0x7f && code <= 0x9f) ||
            LINE_SEPARATORS.includes(code)
        )
            return true;
    }
    return false;
}

/**
 * Validates a post-login destination (FE-56, AUTH-57): a single leading slash, no `//`, backslash,
 * control characters or scheme, and it must resolve to a real non-auth route. Anything else yields the fallback.
 */
export function safeReturnPath(candidate, fallback = DEFAULT_HOME_PATH) {
    if (
        typeof candidate !== "string" ||
        candidate.length === 0 ||
        candidate.length > 2048
    )
        return fallback;
    if (hasControlChars(candidate) || candidate.includes("\\")) return fallback;
    if (!candidate.startsWith("/") || candidate.startsWith("//"))
        return fallback;

    const cut = candidate.search(/[?#]/);
    const pathname = cut === -1 ? candidate : candidate.slice(0, cut);
    if (
        ENCODED_DANGER.test(pathname) ||
        pathname.includes("//") ||
        /^\/[^/]*:/.test(pathname)
    )
        return fallback;
    if (!isReturnablePath(pathname)) return fallback;
    return candidate;
}

/** Reads the return path from router location state first, then `?returnTo=`; always validated. */
export function readReturnTo(location, fallback = DEFAULT_HOME_PATH) {
    const fromState = location?.state?.returnTo;
    if (typeof fromState === "string")
        return safeReturnPath(fromState, fallback);
    const fromQuery = new URLSearchParams(location?.search ?? "").get(
        "returnTo"
    );
    return fromQuery ? safeReturnPath(fromQuery, fallback) : fallback;
}

/** Router `state` object carrying a validated return path, or `undefined` when there is nothing safe to carry. */
export function returnState(location) {
    if (!location?.pathname) return undefined;
    const candidate = `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`;
    const safe = safeReturnPath(candidate, null);
    return safe ? { returnTo: safe } : undefined;
}
