/*
 * Media manifest (MEDIA-30..32). Every Cloudinary slot is declared here; components take a slot name, never a raw id.
 * `publicId: null` + `placeholder: true` means "not uploaded yet": the media components render a flat token-coloured
 * box (MEDIA-31). To replace a placeholder: upload to `samarth-ai/<env>/marketing/`, copy the full public id the upload
 * returns into `publicId`, delete `placeholder`, tick the TODO (MEDIA-32).
 * `proposedPublicId` is the id the team should upload as for production; `uses` names where the slot is rendered.
 * Alt text lives in i18n (`altKey`), never here.
 */

const entry = (fields) =>
    Object.freeze({ placeholder: true, publicId: null, ...fields });

const image = (slotId, { width, height, altKey, uses, decorative = false }) =>
    entry({
        kind: "image",
        width,
        height,
        altKey,
        decorative,
        uses,
        proposedPublicId: `samarth-ai/prod/marketing/${slotId.replaceAll(".", "-")}`,
    });

const tour = (name, key) =>
    image(`landing.tour.${name}`, {
        width: 1600,
        height: 900,
        altKey: `landing:media.${key}`,
        uses: "Landing product tour panel",
    });

const role = (name, key) =>
    image(`landing.roles.${name}`, {
        width: 800,
        height: 600,
        altKey: `landing:media.${key}`,
        uses: "Landing role card (optional)",
    });

const team = (index) =>
    image(`about.team.m${index}`, {
        width: 480,
        height: 480,
        altKey: "landing:media.teamPortrait",
        uses: "About team card; needs the member's consent; initials avatar until uploaded",
    });

export const MEDIA_MANIFEST = Object.freeze({
    "landing.hero.dashboard": image("landing.hero.dashboard", {
        width: 1600,
        height: 1000,
        altKey: "landing:media.heroDashboard",
        uses: "OG fallback and no-JS fallback only (the in-page hero uses a coded mock)",
    }),
    "landing.tour.assessment": tour("assessment", "tourAssessment"),
    "landing.tour.mapping": tour("mapping", "tourMapping"),
    "landing.tour.recs": tour("recs", "tourRecs"),
    "landing.tour.dashboards": tour("dashboards", "tourDashboards"),
    "landing.tour.language": tour("language", "tourLanguage"),
    "landing.roles.learner": role("learner", "rolesLearner"),
    "landing.roles.trainer": role("trainer", "rolesTrainer"),
    "landing.roles.admin": role("admin", "rolesAdmin"),
    "landing.roles.superadmin": role("superadmin", "rolesSuperadmin"),
    "landing.og.default": image("landing.og.default", {
        width: 1200,
        height: 630,
        altKey: "landing:media.ogDefault",
        uses: "Open Graph and Twitter card image",
    }),
    "about.team.m1": team(1),
    "about.team.m2": team(2),
    "about.team.m3": team(3),
    "about.team.m4": team(4),
    "about.team.m5": team(5),
    "about.team.m6": team(6),
    "auth.side": image("auth.side", {
        width: 800,
        height: 1000,
        altKey: "landing:media.authSide",
        decorative: true,
        uses: "Auth split layout side image (rule 10 list, not yet used)",
    }),
});

export const MEDIA_SLOT_IDS = Object.freeze(Object.keys(MEDIA_MANIFEST));

/** Returns the manifest entry for a slot id, or null when the slot is unknown. */
export function getMediaSlot(slot) {
    return MEDIA_MANIFEST[slot] ?? null;
}

/** Slots whose assets are still missing (the team's upload TODO list). */
export function listMediaTodo() {
    return MEDIA_SLOT_IDS.filter(
        (slot) => MEDIA_MANIFEST[slot].placeholder
    ).map((slot) => ({
        slot,
        width: MEDIA_MANIFEST[slot].width,
        height: MEDIA_MANIFEST[slot].height,
        proposedPublicId: MEDIA_MANIFEST[slot].proposedPublicId,
        uses: MEDIA_MANIFEST[slot].uses,
    }));
}
