import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 12;
const RING_RADIUS_PERCENT = 40;

function position(index, count) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return {
        "--x": `${(50 + RING_RADIUS_PERCENT * Math.cos(angle)).toFixed(2)}%`,
        "--y": `${(50 + RING_RADIUS_PERCENT * Math.sin(angle)).toFixed(2)}%`,
    };
}

function RingItem({ item, index, count, rotate, renderItem }) {
    const upright = useTransform(rotate, (value) => -value);
    return (
        <li
            style={position(index, count)}
            className="absolute top-(--y) left-(--x) -translate-x-1/2 -translate-y-1/2"
        >
            <motion.div style={{ rotate: upright }}>
                {renderItem(item, index)}
            </motion.div>
        </li>
    );
}

function Ring({ items, renderItem, children, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });
    const rotate = useTransform(scrollYProgress, [0, 1], [0, 360]);
    return (
        <div
            ref={ref}
            className={cn(
                "relative mx-auto aspect-square w-full max-w-lg",
                className
            )}
        >
            <div
                aria-hidden="true"
                className="absolute inset-[10%] rounded-full border border-border"
            />
            <motion.ul className="absolute inset-0" style={{ rotate }}>
                {items.map((item, index) => (
                    <RingItem
                        key={item.id}
                        item={item}
                        index={index}
                        count={items.length}
                        rotate={rotate}
                        renderItem={renderItem}
                    />
                ))}
            </motion.ul>
            <div className="absolute inset-0 grid place-items-center">
                {children}
            </div>
        </div>
    );
}

/**
 * Ring of up to 12 items that turns once (360 degrees at most) with the scroll while every item stays upright
 * (ANIM-37). `items` is `[{ id, ... }]` and `renderItem(item, index)` renders one item; `children` sit in the
 * middle of the ring and do not move. Not pinned. Lite and reduced tiers show a plain grid.
 */
export function ScrollRotate({ items, renderItem, children, className }) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const list = items.slice(0, MAX_ITEMS);
    if (tier !== "full") {
        return (
            <div className={cn("flex flex-col items-center gap-6", className)}>
                {children}
                <ul className="grid w-full gap-3 sm:grid-cols-2">
                    {list.map((item, index) => (
                        <li key={item.id}>{renderItem(item, index)}</li>
                    ))}
                </ul>
            </div>
        );
    }
    return (
        <Ring items={list} renderItem={renderItem} className={className}>
            {children}
        </Ring>
    );
}
