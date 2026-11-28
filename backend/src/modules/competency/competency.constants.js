const MINUTE_MS = 60_000;

export const COMPETENCY_LIMITS = Object.freeze({
    idMaxLength: 64,
    // The framework has 43 competencies (doc 06); a rating batch can never legitimately exceed this ceiling.
    maxRatings: 60,
    // BE-25: every list is bounded.
    listMax: 100,
    frameworkMax: 100,
});

export const DEFAULT_TARGET_ROLE = "statistical_officer";

/** Per-user limits. Saving a self-assessment writes one row per rated competency, so it is the lowest. */
export const COMPETENCY_RATE_LIMITS = Object.freeze({
    read: {
        name: "competency-read",
        windowMs: 15 * MINUTE_MS,
        limit: 300,
    },
    write: {
        name: "competency-write",
        windowMs: 15 * MINUTE_MS,
        limit: 30,
    },
});
