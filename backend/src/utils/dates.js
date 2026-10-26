const UNITS = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
};
const DURATION_PATTERN = /^(\d{1,9})(ms|s|m|h|d)$/;

/** Parses "15m", "7d", "500ms" into milliseconds; throws a RangeError on anything else. */
export function parseDuration(value) {
    const match = DURATION_PATTERN.exec(String(value).trim());
    if (!match)
        throw new RangeError(
            `Invalid duration "${value}" (expected like 15m, 7d)`
        );
    const ms = Number(match[1]) * UNITS[match[2]];
    if (ms <= 0) throw new RangeError(`Duration must be positive: "${value}"`);
    return ms;
}

/** Current time as a UTC ISO-8601 string (BE-92). */
export const nowIso = (now = new Date()) => now.toISOString();

/** Returns a new Date `ms` milliseconds after `date`. */
export const addMs = (date, ms) => new Date(new Date(date).getTime() + ms);

/** True when `expiresAt` is missing, invalid or not after `now`: code must not rely on TTL indexes (DB-24). */
export function isExpired(expiresAt, now = new Date()) {
    if (!expiresAt) return true;
    const time = new Date(expiresAt).getTime();
    return Number.isNaN(time) || time <= now.getTime();
}

/** The earliest of the given dates (used for min(sliding window, absolute cap), R6). */
export const earliestDate = (...dates) =>
    new Date(Math.min(...dates.map((d) => new Date(d).getTime())));

/** Whole seconds until `date`, never negative (for Retry-After and retryAfterSec). */
export const secondsUntil = (date, now = new Date()) =>
    Math.max(0, Math.ceil((new Date(date).getTime() - now.getTime()) / 1000));
