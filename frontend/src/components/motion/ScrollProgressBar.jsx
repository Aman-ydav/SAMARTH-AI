import { motion, useScroll, useSpring } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { SPRING } from "@/lib/motionTokens";

function ProgressFill() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, SPRING.progress);
    return (
        <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary"
            style={{ scaleX }}
        />
    );
}

/** 2 px page-progress bar fixed to the top (ANIM-43). Not rendered under reduced motion. */
export function ScrollProgressBar() {
    const tier = useMotionTier();
    if (tier === "reduced") return null;
    return <ProgressFill />;
}
