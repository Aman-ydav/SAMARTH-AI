import { useEffect, useState } from "react";

const readScrolled = (threshold) =>
    typeof window !== "undefined" && window.scrollY > threshold;

/**
 * True once the page has scrolled more than `threshold` pixels. Drives the navbar's bottom border (UI-60).
 * One passive listener; state only changes when the boolean flips, so scrolling does not re-render.
 */
export function useScrolled(threshold = 8) {
    const [scrolled, setScrolled] = useState(() => readScrolled(threshold));

    useEffect(() => {
        const update = () => setScrolled(readScrolled(threshold));
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, [threshold]);

    return scrolled;
}
