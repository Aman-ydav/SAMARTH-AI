/*
 * Fixture data for the flat hero product mock (ANIM-61). Numbers only; labels come from the
 * `landing:hero.mock.*` i18n keys by id. All values are illustrative demo data, not statistics.
 */

export const MOCK_COMPETENCIES = Object.freeze([
    { id: "sampling", current: 4, required: 4 },
    { id: "privacy", current: 2, required: 4 },
    { id: "python", current: 3, required: 4 },
    { id: "ml", current: 1, required: 3 },
]);

export const MAX_LEVEL = 5;

/** Gaps ranked by size, then by the order above. Under 0.5 counts as met (docs/23 glossary). */
export function rankedGaps(competencies = MOCK_COMPETENCIES) {
    return competencies
        .map((item) => ({ ...item, gap: item.required - item.current }))
        .filter((item) => item.gap >= 0.5)
        .sort((a, b) => b.gap - a.gap);
}

export const MOCK_PATH = Object.freeze(["privacy", "python", "ml"]);
