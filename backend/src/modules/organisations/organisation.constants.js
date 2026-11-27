const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const ORGANISATION_LIMITS = Object.freeze({
    read: { name: "organisation-read", windowMs: 15 * MINUTE_MS, limit: 300 },
    write: { name: "organisation-write", windowMs: HOUR_MS, limit: 60 },
});
