import { storage } from "@/lib/storage";

export const SUPPORTED_LANGUAGES = Object.freeze(["en", "hi"]);
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export const isSupportedLanguage = (value) =>
    SUPPORTED_LANGUAGES.includes(value);

/** Reduces a locale tag such as `hi-IN` to a supported language, or the fallback. */
export function resolveLanguage(value, fallback = DEFAULT_LANGUAGE) {
    if (typeof value !== "string") return fallback;
    const base = value.trim().toLowerCase().split(/[-_]/)[0];
    return isSupportedLanguage(base) ? base : fallback;
}

/** Persisted choice first, then the browser language (FE-82). The signed-in user's setting is applied after hydration. */
export function detectLanguage() {
    const stored = storage.get("sai-lang");
    if (isSupportedLanguage(stored)) return stored;
    const browser = typeof navigator === "undefined" ? "" : navigator.language;
    return resolveLanguage(browser);
}

/** Latin digits in Hindi too (ANIM-96). */
export function resolveLocale(language) {
    return resolveLanguage(language) === "hi" ? "hi-IN-u-nu-latn" : "en-IN";
}

function toDate(value) {
    if (value === null || value === undefined || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function format(value, language, options) {
    const date = toDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(resolveLocale(language), {
        timeZone: DEFAULT_TIME_ZONE,
        ...options,
    }).format(date);
}

export const formatDate = (value, language = DEFAULT_LANGUAGE) =>
    format(value, language, { dateStyle: "medium" });

export const formatDateTime = (value, language = DEFAULT_LANGUAGE) =>
    format(value, language, { dateStyle: "medium", timeStyle: "short" });

export function formatNumber(value, language = DEFAULT_LANGUAGE, options = {}) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    return new Intl.NumberFormat(resolveLocale(language), options).format(
        value
    );
}

const RELATIVE_UNITS = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
];

/** "5 minutes ago" style text through Intl.RelativeTimeFormat. */
export function formatRelativeTime(
    value,
    language = DEFAULT_LANGUAGE,
    now = Date.now()
) {
    const date = toDate(value);
    if (!date) return "";
    const diffSec = Math.round((date.getTime() - now) / 1000);
    const formatter = new Intl.RelativeTimeFormat(resolveLocale(language), {
        numeric: "auto",
    });
    for (const [unit, seconds] of RELATIVE_UNITS) {
        if (Math.abs(diffSec) >= seconds)
            return formatter.format(Math.trunc(diffSec / seconds), unit);
    }
    return formatter.format(diffSec, "second");
}

/** Countdown text such as `14:59` or `1:02:03`; locale-neutral digits. */
export function formatCountdown(totalSeconds) {
    const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    if (hours > 0)
        return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
    return `${minutes}:${rest}`;
}
