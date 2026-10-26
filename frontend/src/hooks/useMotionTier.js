import { useSyncExternalStore } from "react";

/** Motion tiers (ANIM-20, ANIM-21). `reduced` is the rulebook's `none` tier. */
export const MOTION_TIERS = Object.freeze({
    FULL: "full",
    LITE: "lite",
    REDUCED: "reduced",
});

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const LITE_QUERIES = [
    "(max-width: 767px)",
    "(pointer: coarse)",
    "(max-height: 499px) and (orientation: landscape)",
];

/** True when the browser asks to save data (Network Information API, where it exists). */
export function isSaveDataEnabled() {
    if (typeof navigator === "undefined") return false;
    return Boolean(navigator.connection?.saveData);
}

function matches(query) {
    return window.matchMedia(query).matches;
}

function readTier() {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return MOTION_TIERS.LITE;
    if (matches(REDUCED_QUERY)) return MOTION_TIERS.REDUCED;
    if (isSaveDataEnabled() || LITE_QUERIES.some(matches))
        return MOTION_TIERS.LITE;
    return MOTION_TIERS.FULL;
}

function subscribe(onChange) {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return () => {};
    const lists = [REDUCED_QUERY, ...LITE_QUERIES].map((query) =>
        window.matchMedia(query)
    );
    lists.forEach((list) => list.addEventListener("change", onChange));
    const connection = navigator.connection;
    connection?.addEventListener?.("change", onChange);
    return () => {
        lists.forEach((list) => list.removeEventListener("change", onChange));
        connection?.removeEventListener?.("change", onChange);
    };
}

const getServerSnapshot = () => MOTION_TIERS.FULL;

/**
 * Single source of the motion tier. `reduced`: prefers-reduced-motion, everything static.
 * `lite`: narrow, coarse pointer, short landscape or Save-Data; only the light techniques.
 * `full`: everything else. Components never read matchMedia or innerWidth themselves.
 */
export function useMotionTier() {
    return useSyncExternalStore(subscribe, readTier, getServerSnapshot);
}
