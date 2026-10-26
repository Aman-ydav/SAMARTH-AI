import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useLocation } from "react-router";
import { useMotionTier } from "@/hooks/useMotionTier";

/**
 * Lenis smooth scroll for the marketing layout (ANIM-06, ANIM-22). Mounts only on the `full` tier, so reduced
 * motion and lite devices keep native scrolling. Overlays opt out with `data-lenis-prevent` (ANIM-23).
 * Scrolls to the top on every route change.
 */
export function SmoothScrollProvider({ children }) {
    const tier = useMotionTier();
    const { pathname } = useLocation();
    const lenisRef = useRef(null);

    useEffect(() => {
        if (tier !== "full") return undefined;
        const lenis = new Lenis({ autoRaf: true, anchors: true });
        lenisRef.current = lenis;
        return () => {
            lenis.destroy();
            lenisRef.current = null;
        };
    }, [tier]);

    useEffect(() => {
        lenisRef.current?.scrollTo(0, { immediate: true, force: true });
    }, [pathname]);

    return children;
}
