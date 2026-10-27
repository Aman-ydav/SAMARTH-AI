import { useLayoutEffect, useRef } from "react";

/**
 * Keeps the CSS variable `--fit-scale` on the returned ref's element equal to its width divided by `designWidth`,
 * so a fixed-size design can be drawn with `scale-(--fit-scale)` and still fit a fluid frame (no inline sizes, no
 * layout shift: the frame reserves its size with an aspect ratio). Reads width once on mount and on resize only.
 */
export function useFitScale(designWidth) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return undefined;
        const apply = () => {
            const width = element.clientWidth;
            if (width > 0)
                element.style.setProperty(
                    "--fit-scale",
                    String(width / designWidth)
                );
        };
        apply();
        if (typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver(apply);
        observer.observe(element);
        return () => observer.disconnect();
    }, [designWidth]);
    return ref;
}
