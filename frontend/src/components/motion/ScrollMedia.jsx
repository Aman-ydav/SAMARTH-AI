import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const FADE_HALF_WIDTH = 0.06;
const MAX_FRAMES = 8;

function ScrollFrame({ progress, index, count, children }) {
    const fadeIn = index / count;
    const fadeOut = (index + 1) / count;
    const isFirst = index === 0;
    const isLast = index === count - 1;
    const inputs = [];
    const outputs = [];
    if (!isFirst) {
        inputs.push(fadeIn - FADE_HALF_WIDTH, fadeIn + FADE_HALF_WIDTH);
        outputs.push(0, 1);
    }
    if (!isLast) {
        inputs.push(fadeOut - FADE_HALF_WIDTH, fadeOut + FADE_HALF_WIDTH);
        outputs.push(1, 0);
    }
    if (isFirst) {
        inputs.unshift(0);
        outputs.unshift(1);
    }
    if (isLast) {
        inputs.push(1);
        outputs.push(1);
    }
    const opacity = useTransform(progress, inputs, outputs, { clamp: true });
    return (
        <motion.div
            className="col-start-1 row-start-1 w-full"
            style={{ opacity }}
        >
            {children}
        </motion.div>
    );
}

function PinnedFrames({ frames, className }) {
    const trackRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: trackRef,
        offset: ["start start", "end end"],
    });
    return (
        <div
            ref={trackRef}
            style={{ "--frames": frames.length }}
            className={cn(
                "relative h-[calc(var(--frames)*32svh+45svh)]",
                className
            )}
        >
            <div className="sticky top-0 grid h-svh place-items-center overflow-clip">
                {frames.map((frame, index) => (
                    <ScrollFrame
                        key={frame.id}
                        progress={scrollYProgress}
                        index={index}
                        count={frames.length}
                    >
                        {frame.content}
                    </ScrollFrame>
                ))}
            </div>
        </div>
    );
}

/**
 * Pinned stage that crossfades through up to 8 frames as the track scrolls (ANIM-40). `frames` is
 * `[{ id, content }]` where `content` is any node (text plus a `CloudinaryImage`; make the first image `priority`).
 * Every frame stays in the DOM in order. Lite and reduced tiers stack the frames vertically.
 */
export function ScrollMedia({ frames, className }) {
    const tier = useMotionTier();
    if (!frames?.length) return null;
    const list = frames.slice(0, MAX_FRAMES);
    if (tier !== "full") {
        return (
            <div className={cn("flex flex-col gap-16", className)}>
                {list.map((frame) => (
                    <div key={frame.id}>{frame.content}</div>
                ))}
            </div>
        );
    }
    return <PinnedFrames frames={list} className={className} />;
}
