import { env } from "#config/env.js";
import { COOKIE_NAMES, REFRESH_COOKIE_PATH } from "#constants/cookieNames.js";

/**
 * The only place that sets or clears cookies (AUTH-03, BE-28). Names, flags and paths follow charter section 4.
 * Clearing repeats the exact attributes used when setting (AUTH-12), otherwise the browser keeps the cookie.
 */
export function createCookieHelpers(config = env) {
    const { secure, sameSite, domain } = config.cookies;
    const shared = { secure, sameSite, ...(domain ? { domain } : {}) };
    const httpOnlyAt = (path) => ({ ...shared, httpOnly: true, path });
    const readableByScript = { ...shared, httpOnly: false, path: "/" };
    const refreshLifetime = (remember) =>
        remember
            ? config.auth.refreshRememberExpiryMs
            : config.auth.refreshExpiryMs;

    const helpers = {
        /** `sai_access`: HttpOnly JWT, path `/`, 15 minutes. */
        setAccessCookie(res, accessToken) {
            res.cookie(COOKIE_NAMES.ACCESS, accessToken, {
                ...httpOnlyAt("/"),
                maxAge: config.auth.accessExpiryMs,
            });
        },
        /** `sai_refresh`: HttpOnly opaque token scoped to the auth routes; lifetime follows remember-me (R6). */
        setRefreshCookie(res, refreshToken, { remember = false } = {}) {
            res.cookie(COOKIE_NAMES.REFRESH, refreshToken, {
                ...httpOnlyAt(REFRESH_COOKIE_PATH),
                maxAge: refreshLifetime(remember),
            });
        },
        /** `sai_csrf`: readable by JS, same lifetime as the refresh cookie of that session. */
        setCsrfCookie(res, csrfToken, { remember = false } = {}) {
            res.cookie(COOKIE_NAMES.CSRF, csrfToken, {
                ...readableByScript,
                maxAge: refreshLifetime(remember),
            });
        },
        clearAccessCookie(res) {
            res.clearCookie(COOKIE_NAMES.ACCESS, httpOnlyAt("/"));
        },
        clearRefreshCookie(res) {
            res.clearCookie(
                COOKIE_NAMES.REFRESH,
                httpOnlyAt(REFRESH_COOKIE_PATH)
            );
        },
        clearCsrfCookie(res) {
            res.clearCookie(COOKIE_NAMES.CSRF, readableByScript);
        },
        /** Logout: clears all three. */
        clearAuthCookies(res) {
            helpers.clearAccessCookie(res);
            helpers.clearRefreshCookie(res);
            helpers.clearCsrfCookie(res);
        },
        /** Login/refresh: sets all three; omit `refreshToken` for the must-change-password limited session (AUTH-38). */
        setSessionCookies(
            res,
            { accessToken, refreshToken, csrfToken, remember = false }
        ) {
            helpers.setAccessCookie(res, accessToken);
            if (refreshToken)
                helpers.setRefreshCookie(res, refreshToken, { remember });
            helpers.setCsrfCookie(res, csrfToken, { remember });
        },
    };
    return helpers;
}

export const cookies = createCookieHelpers();
