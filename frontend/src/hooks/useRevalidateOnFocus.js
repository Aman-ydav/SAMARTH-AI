import { useEffect, useRef } from "react";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Calls `revalidate` when the tab becomes visible again after `minIdleMs` (FE-60). */
export function useRevalidateOnFocus(
    revalidate,
    { minIdleMs = FIVE_MINUTES_MS } = {}
) {
    const callback = useRef(revalidate);
    const lastRun = useRef(0);

    useEffect(() => {
        callback.current = revalidate;
    }, [revalidate]);

    useEffect(() => {
        lastRun.current = Date.now();
        const onVisibility = () => {
            if (document.visibilityState !== "visible") return;
            if (Date.now() - lastRun.current < minIdleMs) return;
            lastRun.current = Date.now();
            callback.current();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () =>
            document.removeEventListener("visibilitychange", onVisibility);
    }, [minIdleMs]);
}
