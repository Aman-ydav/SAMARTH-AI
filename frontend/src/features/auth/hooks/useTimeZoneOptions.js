const FALLBACK_ZONES = Object.freeze([
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "UTC",
]);

let cached = null;

/** Time zones the browser knows (`Intl.supportedValuesOf`), or a short safe list where that API is missing (older browsers). */
export function listTimeZones() {
    if (cached) return cached;
    let zones = [];
    try {
        if (typeof Intl.supportedValuesOf === "function")
            zones = Intl.supportedValuesOf("timeZone");
    } catch {
        zones = [];
    }
    cached = Object.freeze(zones.length > 0 ? zones : [...FALLBACK_ZONES]);
    return cached;
}

/**
 * Options for the time zone select, always containing the saved value even if the browser list lacks it. Browsers list
 * canonical ids (Chrome says `Asia/Calcutta`, not `Asia/Kolkata`, and omits `UTC`), while the API default is `Asia/Kolkata`.
 */
export function useTimeZoneOptions(current) {
    const zones = listTimeZones();
    if (typeof current === "string" && current && !zones.includes(current))
        return [current, ...zones];
    return zones;
}
