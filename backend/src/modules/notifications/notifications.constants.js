const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A `link` is an in-app path only: one leading slash, no scheme, no backslash, no whitespace (AUTH-57). */
export const NOTIFICATION_LINK_PATTERN = /^\/(?!\/)[^\s\\]*$/;

export const NOTIFICATION_LIMITS = Object.freeze({
    subjectMaxLength: 120,
    refIdMaxLength: 64,
    linkMaxLength: 200,
    dedupeKeyMaxLength: 128,
    // DB-16: growth with no natural cap needs a ceiling, so each user keeps their newest 200.
    perUserCap: 200,
    trimBatch: 100,
    // doc 22 section 6: notifications live 90 days.
    retentionMs: 90 * DAY_MS,
});

/** Per-user limits. The bell polls the count about once a minute per open tab, so the count limit is the highest. */
export const NOTIFICATION_RATE_LIMITS = Object.freeze({
    read: {
        name: "notifications-read",
        windowMs: 15 * MINUTE_MS,
        limit: 300,
    },
    count: {
        name: "notifications-count",
        windowMs: 15 * MINUTE_MS,
        limit: 600,
    },
    write: {
        name: "notifications-write",
        windowMs: 15 * MINUTE_MS,
        limit: 300,
    },
});
