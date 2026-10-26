import { useEffect, useRef } from "react";

/**
 * Moves keyboard focus to the page heading once on mount (state and edge pages, FE-70). The root layout also
 * focuses <main> after navigation; the microtask makes sure the heading wins because it runs after every effect.
 * Attach the returned ref to an <h1 tabIndex={-1}>.
 */
export function usePageHeadingFocus() {
    const headingRef = useRef(null);
    useEffect(() => {
        queueMicrotask(() => {
            headingRef.current?.focus({ preventScroll: true });
        });
    }, []);
    return headingRef;
}
