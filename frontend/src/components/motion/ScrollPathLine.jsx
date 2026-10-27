import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const MAX_STOPS = 8;
/* Share of the line over which one stop fades from unlit to lit. */
const LIGHT_SPAN = 0.06;
const TEXT_MIN_OPACITY = 0.5;

const listClass = "relative flex flex-col gap-10";

function Marker({ lit }) {
    return (
        <span
            aria-hidden="true"
            className="absolute top-1 left-0 size-4 rounded-full border-2 border-border bg-background"
        >
            <motion.span
                style={lit ? { opacity: lit } : undefined}
                className="absolute -inset-0.5 rounded-full bg-primary"
            />
        </span>
    );
}

function Track({ progress }) {
    return (
        <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-1.75 w-0.5 bg-border"
        >
            <motion.div
                style={progress ? { scaleY: progress } : undefined}
                className="size-full origin-top bg-primary"
            />
        </div>
    );
}

function DrawnStop({ item, index, count, progress, renderItem }) {
    const start = index / count;
    const lit = useTransform(
        progress,
        [Math.max(0, start - LIGHT_SPAN), start],
        [0, 1]
    );
    const textOpacity = useTransform(lit, [0, 1], [TEXT_MIN_OPACITY, 1]);
    return (
        <li className="relative pl-10">
            <Marker lit={lit} />
            <motion.div style={{ opacity: textOpacity }}>
                {renderItem(item, index)}
            </motion.div>
        </li>
    );
}

function DrawnPath({ items, renderItem, label, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 75%", "end 60%"],
    });
    return (
        <ol ref={ref} aria-label={label} className={cn(listClass, className)}>
            <Track progress={scrollYProgress} />
            {items.map((item, index) => (
                <DrawnStop
                    key={item.id}
                    item={item}
                    index={index}
                    count={items.length}
                    progress={scrollYProgress}
                    renderItem={renderItem}
                />
            ))}
        </ol>
    );
}

function StaticPath({ items, renderItem, label, className }) {
    return (
        <ol aria-label={label} className={cn(listClass, className)}>
            <Track />
            {items.map((item, index) => (
                <li key={item.id} className="relative pl-10">
                    <Marker />
                    <div>{renderItem(item, index)}</div>
                </li>
            ))}
        </ol>
    );
}

/**
 * Vertical timeline whose line is drawn by scroll progress (PATH_DRAW, ANIM-45). The line scales on Y and each stop
 * lights up (opacity only) as the line reaches it. `items` is `[{ id, ... }]` (8 at most) and
 * `renderItem(item, index)` renders the text of one stop. Every stop stays in the DOM in order. Lite and reduced
 * tiers show the finished line with every stop lit.
 */
export function ScrollPathLine({ items, renderItem, label, className }) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const stops = items.slice(0, MAX_STOPS);
    const Path = tier === "full" ? DrawnPath : StaticPath;
    return (
        <Path
            items={stops}
            renderItem={renderItem}
            label={label}
            className={className}
        />
    );
}
