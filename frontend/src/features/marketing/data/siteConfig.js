/*
 * Public site values for the marketing pages (docs/23 placeholders). Public values only, no secrets.
 * TODO(team): replace the example.test contact values and confirm the production origin (docs/23 section 8).
 */

export const SITE_CONFIG = Object.freeze({
    name: "SAMARTH AI",
    supportEmail: "support@example.test",
    grievanceEmail: "grievance@example.test",
    ogImageSlot: "landing.og.default",
    twitterCard: "summary_large_image",
});

/** Origin used for canonical and Open Graph URLs: the page's own origin until a production domain is fixed. */
export function getSiteUrl() {
    if (typeof window === "undefined" || !window.location?.origin) return "";
    return window.location.origin.replace(/\/+$/, "");
}

/** Absolute URL for a site path such as `/about`. */
export function absoluteUrl(path = "/") {
    return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
