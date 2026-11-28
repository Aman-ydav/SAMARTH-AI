const MINUTE_MS = 60_000;

export const LEARNING_LIMITS = Object.freeze({
    idMaxLength: 64,
    domainMaxLength: 80,
    providerMaxLength: 80,
    searchMaxLength: 100,
    // The most courses read for one request: the catalogue is filtered and ranked in memory, so it needs a ceiling (BE-25).
    catalogueMax: 500,
    // BE-25: every list is bounded.
    listMax: 100,
    recommendationsMax: 100,
});

export const DEFAULT_TARGET_ROLE = "statistical_officer";

/** Per-user limits. Enrolling and progress updates write, so they carry the lower ceiling. */
export const LEARNING_RATE_LIMITS = Object.freeze({
    read: {
        name: "learning-read",
        windowMs: 15 * MINUTE_MS,
        limit: 300,
    },
    write: {
        name: "learning-write",
        windowMs: 15 * MINUTE_MS,
        limit: 60,
    },
});
