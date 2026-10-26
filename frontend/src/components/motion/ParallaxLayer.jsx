import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { PARALLAX_MAX_PX } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

function MovingLayer({ children, distance, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });
    const y = useTransform(
        scrollYProgress,
        [0, 1],
        [-distance / 2, distance / 2]
    );
    return (
        <div
            ref={ref}
            aria-hidden="true"
            className={cn("overflow-clip", className)}
        >
            <motion.div className="h-full" style={{ y }}>
                {children}
            </motion.div>
        </div>
    );
}

/**
 * Decorative flat layer that drifts on Y only (ANIM-36). `distance` is the total travel in px, capped at 120.
 * Always `aria-hidden` and clipped by its own wrapper. Static on lite and reduced tiers.
 */
export function ParallaxLayer({ children, distance = 80, className }) {
    const tier = useMotionTier();
    if (tier !== "full") {
        return (
            <div aria-hidden="true" className={cn("overflow-clip", className)}>
                {children}
            </div>
        );
    }
    return (
        <MovingLayer
            distance={Math.min(Math.abs(distance), PARALLAX_MAX_PX)}
            className={className}
        >
            {children}
        </MovingLayer>
    );
}
