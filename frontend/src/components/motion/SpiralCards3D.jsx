import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const MAX_CARDS = 8;
const ROTATION_DONE_AT = 0.85;
const STEP_RISE_PX = 36;

function SpiralCard({ index, count, radius, children }) {
    const angle = (360 / count) * index;
    const rise = (index - (count - 1) / 2) * STEP_RISE_PX;
    return (
        <motion.li
            className="absolute top-1/2 left-1/2 -ml-32 -mt-24 w-64 transform-3d"
            style={{ rotateY: angle }}
        >
            <motion.div
                className="backface-hidden"
                style={{ z: radius, y: rise }}
            >
                {children}
            </motion.div>
        </motion.li>
    );
}

function PinnedSpiral({ items, renderItem, radius, className }) {
    const trackRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: trackRef,
        offset: ["start start", "end end"],
    });
    const count = items.length;
    const turn = useTransform(
        scrollYProgress,
        [0, ROTATION_DONE_AT],
        [0, -(360 - 360 / count)],
        { clamp: true }
    );
    return (
        <div ref={trackRef} className={cn("relative h-[200svh]", className)}>
            <div className="sticky top-0 grid h-svh place-items-center overflow-clip perspective-distant">
                <motion.ol
                    className="relative size-full transform-3d"
                    style={{ rotateY: turn }}
                >
                    {items.map((item, index) => (
                        <SpiralCard
                            key={item.id}
                            index={index}
                            count={count}
                            radius={radius}
                        >
                            {renderItem(item, index)}
                        </SpiralCard>
                    ))}
                </motion.ol>
            </div>
        </div>
    );
}

/**
 * Cards on a 3D spiral that rotate inside a pinned stage (ANIM-38). Up to 8 cards, in DOM order (the seven
 * SAMARTH letters S-A-M-A-R-T-H), no blur. `items` is `[{ id, ... }]`, `renderItem(item, index)` renders a
 * card face (cards are 16rem wide). Lite and reduced tiers render a one-column list.
 */
export function SpiralCards3D({ items, renderItem, radius = 300, className }) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const list = items.slice(0, MAX_CARDS);
    if (tier !== "full") {
        return (
            <ol className={cn("flex flex-col gap-4", className)}>
                {list.map((item, index) => (
                    <li key={item.id}>{renderItem(item, index)}</li>
                ))}
            </ol>
        );
    }
    return (
        <PinnedSpiral
            items={list}
            renderItem={renderItem}
            radius={radius}
            className={className}
        />
    );
}
