const PERSISTENT_KEYS = new Set(["sai-theme", "sai-lang", "sai-sidebar"]);
const TAB_KEYS = new Set(["sai-return-to", "sai-chunk-reload"]);
const DRAFT_KEY_PREFIX = "sai-quiz-draft:";

function areaFor(key) {
    if (PERSISTENT_KEYS.has(key)) return "persistent";
    if (TAB_KEYS.has(key)) return "tab";
    if (
        typeof key === "string" &&
        key.startsWith(DRAFT_KEY_PREFIX) &&
        key.length > DRAFT_KEY_PREFIX.length
    ) {
        return "tab";
    }
    return null;
}

function getArea(area) {
    try {
        return area === "persistent"
            ? globalThis.localStorage
            : globalThis.sessionStorage;
    } catch {
        return null;
    }
}

/**
 * Sole gateway to browser storage (FE-106). Only the allow-listed non-sensitive keys can be used;
 * every call is wrapped so blocked or full storage degrades to the fallback instead of throwing.
 */
export const storage = {
    get(key, fallback = null) {
        const area = areaFor(key);
        if (!area) return fallback;
        try {
            const value = getArea(area)?.getItem(key);
            return value === null || value === undefined ? fallback : value;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        const area = areaFor(key);
        if (!area) return false;
        try {
            const target = getArea(area);
            if (!target) return false;
            target.setItem(key, String(value));
            return true;
        } catch {
            return false;
        }
    },
    remove(key) {
        const area = areaFor(key);
        if (!area) return false;
        try {
            const target = getArea(area);
            if (!target) return false;
            target.removeItem(key);
            return true;
        } catch {
            return false;
        }
    },
};
