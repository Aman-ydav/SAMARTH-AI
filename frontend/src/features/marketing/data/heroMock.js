/*
 * Fixture data for the hero laptop screen and the How-it-works visuals (ANIM-61). Numbers and ids only; every
 * label comes from the `landing:hero.mock.*` i18n keys by id. All of it is illustrative DEMO data (a fictional
 * learner), not statistics and not a real person.
 */

export const MAX_LEVEL = 5;

/** `current` = the starting estimate; `evidenceLevel` = the level after the quiz of the last tour step. `importance` 1..3. */
export const MOCK_COMPETENCIES = Object.freeze([
    {
        id: "sampling",
        domain: "statistical",
        current: 4,
        required: 4,
        importance: 3,
    },
    {
        id: "surveyDesign",
        domain: "statistical",
        current: 3,
        required: 4,
        importance: 3,
    },
    {
        id: "dataQuality",
        domain: "statistical",
        current: 3,
        required: 3,
        importance: 2,
    },
    { id: "sdmx", domain: "technical", current: 2, required: 3, importance: 2 },
    {
        id: "python",
        domain: "technical",
        current: 3,
        required: 4,
        importance: 3,
    },
    {
        id: "privacy",
        domain: "digitalGovernance",
        current: 2,
        required: 4,
        importance: 3,
        evidenceLevel: 3,
        confidence: "medium",
    },
    { id: "ml", domain: "technical", current: 1, required: 3, importance: 3 },
    {
        id: "leadership",
        domain: "behavioural",
        current: 3,
        required: 3,
        importance: 2,
    },
]);

/** Confidence of the starting estimate, by competency (How-it-works profile visual). */
export const MOCK_CONFIDENCE = Object.freeze({
    sampling: "high",
    surveyDesign: "medium",
    dataQuality: "medium",
    sdmx: "low",
    python: "medium",
    privacy: "low",
    ml: "low",
    leadership: "high",
});

/** Level of one competency, optionally after the evidence of the last tour step. */
export function levelOf(item, afterEvidence = false) {
    return afterEvidence && item.evidenceLevel !== undefined
        ? item.evidenceLevel
        : item.current;
}

/** Priority from gap size times role importance (docs/23 glossary: gap = required minus current, positive only). */
export function priorityOf(gap, importance) {
    const score = gap * importance;
    if (score >= 6) return "high";
    if (score >= 3) return "medium";
    return "low";
}

/** Gaps ranked by priority score, then gap, then fixture order. Under 0.5 counts as met. */
export function rankedGaps(
    competencies = MOCK_COMPETENCIES,
    afterEvidence = false
) {
    return competencies
        .map((item, order) => {
            const level = levelOf(item, afterEvidence);
            const gap = item.required - level;
            const importance = item.importance ?? 1;
            return {
                ...item,
                current: level,
                gap,
                order,
                priority: priorityOf(gap, importance),
                score: gap * importance,
            };
        })
        .filter((item) => item.gap >= 0.5)
        .sort(
            (a, b) => b.score - a.score || b.gap - a.gap || a.order - b.order
        );
}

/** Gap rows in the fixed starting ranking, with levels and priorities updated for the evidence step (rows never reorder mid-tour). */
export function gapRows(afterEvidence = false) {
    return rankedGaps().map((row) => {
        const level = levelOf(row, afterEvidence);
        const gap = row.required - level;
        return {
            ...row,
            current: level,
            gap,
            priority: priorityOf(gap, row.importance),
        };
    });
}

/** Overall readiness in percent: sum of min(level, required) over sum of required. */
export function readiness(
    competencies = MOCK_COMPETENCIES,
    afterEvidence = false
) {
    const need = competencies.reduce((sum, item) => sum + item.required, 0);
    const have = competencies.reduce(
        (sum, item) =>
            sum + Math.min(levelOf(item, afterEvidence), item.required),
        0
    );
    return need === 0 ? 0 : Math.round((have / need) * 100);
}

/** Recommended learning path in order. `source` is simulated in this prototype. `after` = progress after the evidence step. */
export const MOCK_PATH = Object.freeze([
    {
        id: "privacy",
        closes: "privacy",
        source: "igot",
        hours: 3,
        progress: 60,
        after: 100,
    },
    {
        id: "python",
        closes: "python",
        source: "nssta",
        hours: 8,
        progress: 20,
        after: 20,
    },
    {
        id: "ml",
        closes: "ml",
        source: "igot",
        hours: 10,
        progress: 0,
        after: 0,
    },
    {
        id: "sdmx",
        closes: "sdmx",
        source: "nssta",
        hours: 4,
        progress: 0,
        after: 0,
    },
]);

export const MOCK_KPIS = Object.freeze({
    assessed: { value: MOCK_COMPETENCIES.length },
    hours: { value: 12, after: 13 },
    streak: { value: 6, after: 7 },
});

/** Sidebar entries in order; the sidebar component maps ids to registry icons. */
export const MOCK_NAV = Object.freeze([
    { id: "dashboard" },
    { id: "competency", active: true },
    { id: "path" },
    { id: "quizzes" },
    { id: "tutor" },
    { id: "certificates" },
    { id: "settings" },
]);

/** Activity feed below the first slot. Slot 0 swaps from `pathReady` to `quizPassed` at the evidence step. */
export const MOCK_FEED = Object.freeze([
    { id: "courseStarted", when: "today" },
    { id: "endorsed", when: "yesterday" },
    { id: "profile", when: "days" },
]);

export const MOCK_SESSIONS = Object.freeze([
    { id: "sampling", when: "tue", mode: "online", source: "nssta" },
    { id: "quality", when: "thu", mode: "inPerson", source: "nssta" },
    { id: "python", when: "fri", mode: "online", source: "igot" },
]);

/**
 * The hero tour in story order (ANIM-64). `focus` lists the cards that get the highlight border, `shift` 1 moves the
 * screen content up so the lower row of cards is in view (0 = top of the page), `required` shows the role markers, `evidence` applies the quiz.
 */
export const TOUR_STEPS = Object.freeze([
    {
        id: "profile",
        focus: ["kpis", "levels"],
        shift: 0,
        required: false,
        evidence: false,
    },
    {
        id: "gaps",
        focus: ["gaps", "levels"],
        shift: 0,
        required: true,
        evidence: false,
    },
    { id: "path", focus: ["path"], shift: 1, required: true, evidence: false },
    {
        id: "evidence",
        focus: ["feed", "levels"],
        shift: 1,
        required: true,
        evidence: true,
    },
]);
