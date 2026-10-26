import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ScrollTilt3D } from "@/components/motion/ScrollTilt3D";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const ZOOM_DONE_AT = 0.7;
const MIN_START_SCALE = 0.6;

function ZoomTrack({ children, className, startScale, tilt }) {
    const trackRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: trackRef,
        offset: ["start start", "end end"],
    });
    const scale = useTransform(
        scrollYProgress,
        [0, ZOOM_DONE_AT],
        [startScale, 1],
        { clamp: true }
    );
    return (
        <div ref={trackRef} className={cn("relative h-[250svh]", className)}>
            <div className="sticky top-0 flex h-svh items-center justify-center overflow-clip">
                <motion.div
                    className="w-full will-change-transform"
                    style={{ scale }}
                >
                    {tilt ? (
                        <ScrollTilt3D progress={scrollYProgress}>
                            {children}
                        </ScrollTilt3D>
                    ) : (
                        children
                    )}
                </motion.div>
            </div>
        </div>
    );
}

/**
 * Pinned frame that scales from `startScale` (0.6 or more) up to exactly 1 and then holds (ANIM-32).
 * A 250svh track holds a sticky `h-svh` stage; the zoom is done by 70% of the track. `tilt` composes
 * `ScrollTilt3D` so the content also lifts from tilted to flat. Plain, natural-size block on lite and reduced tiers.
 */
export function ZoomScrollSection({
    children,
    className,
    startScale = MIN_START_SCALE,
    tilt = true,
}) {
    const tier = useMotionTier();
    if (tier !== "full") return <div className={className}>{children}</div>;
    return (
        <ZoomTrack
            className={className}
            startScale={Math.min(1, Math.max(MIN_START_SCALE, startScale))}
            tilt={tilt}
        >
            {children}
        </ZoomTrack>
    );
}
