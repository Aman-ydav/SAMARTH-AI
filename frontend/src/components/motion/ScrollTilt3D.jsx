import { motion, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { TILT_MAX_DEG } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

const PERSPECTIVE_PX = 1200;
const START_OPACITY = 0.7;

function TiltedFrame({ progress, tilt, end, children, className }) {
    const rotateX = useTransform(progress, [0, end], [tilt, 0], {
        clamp: true,
    });
    const opacity = useTransform(progress, [0, end], [START_OPACITY, 1], {
        clamp: true,
    });
    return (
        <motion.div
            className={cn("origin-bottom", className)}
            style={{ rotateX, opacity, transformPerspective: PERSPECTIVE_PX }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Lifts its content from tilted to flat while `progress` (a 0..1 MotionValue, usually the scroll progress of a
 * pinned track) runs to `end` (ANIM-33). Animates only rotateX and opacity, tilt is capped at 35 degrees.
 * Renders the content flat when no progress is given or the tier is not `full`.
 */
export function ScrollTilt3D({
    progress,
    tilt = 30,
    end = 0.7,
    children,
    className,
}) {
    const tier = useMotionTier();
    if (tier !== "full" || !progress) {
        return <div className={className}>{children}</div>;
    }
    return (
        <TiltedFrame
            progress={progress}
            tilt={Math.min(Math.abs(tilt), TILT_MAX_DEG)}
            end={end}
            className={className}
        >
            {children}
        </TiltedFrame>
    );
}
