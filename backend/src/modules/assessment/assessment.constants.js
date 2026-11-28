const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A learner may attempt one quiz three times in any rolling 24 hours; the fourth is a 429 QUIZ_ATTEMPT_LIMIT. */
export const QUIZ_ATTEMPT_LIMIT = Object.freeze({
    maxAttempts: 3,
    windowMs: DAY_MS,
});

export const ASSESSMENT_LIMITS = Object.freeze({
    idMaxLength: 64,
    domainMaxLength: 80,
    maxAnswers: 100,
    // BE-25: every list is bounded.
    listMax: 100,
});

/** Per-user limits. Submitting is the costly call (scoring plus a competency write), so it has the lowest ceiling. */
export const ASSESSMENT_RATE_LIMITS = Object.freeze({
    read: {
        name: "assessment-read",
        windowMs: 15 * MINUTE_MS,
        limit: 300,
    },
    submit: {
        name: "assessment-submit",
        windowMs: 15 * MINUTE_MS,
        limit: 30,
    },
});
