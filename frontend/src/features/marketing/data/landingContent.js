/*
 * Structure of the landing page. All copy lives in the `landing` i18n namespace (docs/23 section 3);
 * these lists only hold ids, non-translatable facts (numbers, statuses, hrefs) and the i18n keys to use.
 */

import { PATHS } from "@/lib/paths";

export const LANDING_SECTION_IDS = Object.freeze({
    how: "how",
    features: "features",
    security: "security",
    faq: "faq",
});

/**
 * SAMARTH letters in order. The Landing page no longer shows the acronym section (ANIM-50, 2026-10-27); this list stays
 * because the reused AcronymSection (About) reads it. `status` follows docs/23 section 1.2: null = core.
 */
export const ACRONYM_CARDS = Object.freeze([
    { id: "s", letter: "S", status: null },
    { id: "a1", letter: "A", status: "partial" },
    { id: "m", letter: "M", status: null },
    { id: "a2", letter: "A", status: "partial" },
    { id: "r", letter: "R", status: "simulated" },
    { id: "t", letter: "T", status: "planned" },
    { id: "h", letter: "H", status: null },
]);

/** Rows of the "measure" beat: ids of heroMock competencies, in display order (docs/23 landing.measure). */
export const MEASURE_ROW_IDS = Object.freeze([
    "sampling",
    "surveyDesign",
    "python",
    "privacy",
    "ml",
    "sdmx",
]);

/** Stops of the journey beat (PATH_DRAW): courses from the demo path with a quiz after the first one. `source` is simulated. */
export const JOURNEY_STOPS = Object.freeze([
    { id: "privacy", source: "igot", hours: 3 },
    { id: "quiz", kind: "quiz" },
    { id: "python", source: "nssta", hours: 8 },
    { id: "ml", source: "igot", hours: 10 },
]);

/** Illustrative audit-chain blocks of the trust beat: each block names the hash of the one before it. Not real hashes. */
export const CHAIN_BLOCKS = Object.freeze([
    { id: "b1", hash: "9f3a", prev: "0000" },
    { id: "b2", hash: "c71e", prev: "9f3a" },
    { id: "b3", hash: "2b8d", prev: "c71e" },
    { id: "b4", hash: "e540", prev: "2b8d" },
]);

export const HOW_STEP_IDS = Object.freeze([
    "profile",
    "gaps",
    "path",
    "evidence",
]);

/** Tour panels in order; each has a media slot (Cloudinary, demo data). */
export const TOUR_PANELS = Object.freeze([
    { id: "assessment", slot: "landing.tour.assessment" },
    { id: "mapping", slot: "landing.tour.mapping" },
    { id: "recs", slot: "landing.tour.recs", alwaysBanner: true },
    { id: "dashboards", slot: "landing.tour.dashboards" },
    { id: "language", slot: "landing.tour.language" },
]);

export const ROLE_CARDS = Object.freeze([
    { id: "learner", slot: "landing.roles.learner" },
    { id: "trainer", slot: "landing.roles.trainer" },
    { id: "admin", slot: "landing.roles.admin" },
    { id: "superadmin", slot: "landing.roles.superadmin" },
]);

/** Real framework figures from the product docs (docs/23 section 3, landing.framework). */
export const FRAMEWORK_FIGURES = Object.freeze([
    { id: "domains", value: 4 },
    { id: "competencies", value: 43 },
    { id: "levels", value: 6 },
    { id: "roles", value: 10 },
]);

export const FRAMEWORK_DOMAINS = Object.freeze([
    { id: "statistical", count: 14 },
    { id: "technical", count: 14 },
    { id: "digitalGovernance", count: 7 },
    { id: "behavioural", count: 8 },
]);

/** Trust bullets; `badge` is the i18n key under `trust.badge`, or null. */
export const TRUST_ITEMS = Object.freeze([
    { id: "tokens", badge: "prototype" },
    { id: "rbac", badge: "prototype" },
    { id: "sessions", badge: "designed" },
    { id: "audit", badge: "designed" },
    { id: "ai", badge: "designed" },
    { id: "anchor", badge: "designedOptional" },
    { id: "dpdp", badge: null },
]);

export const LANDING_LINKS = Object.freeze({
    getStarted: PATHS.getStarted,
    login: PATHS.login,
    privacy: PATHS.privacy,
    howAnchor: `#${LANDING_SECTION_IDS.how}`,
});
