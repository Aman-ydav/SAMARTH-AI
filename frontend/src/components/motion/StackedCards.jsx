import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const MAX_CARDS = 6;
/* Each card behind the front one shrinks by this much more; six cards stay above the 0.85 floor (ANIM-46). */
const SCALE_STEP = 0.03;
const STICK_BASE_REM = 5;
const STICK_STEP_REM = 1;

function StackCard({ item, index, count, progress, renderItem }) {
    const scale = useTransform(
        progress,
        [index / count, 1],
        [1, 1 - (count - 1 - index) * SCALE_STEP]
    );
    return (
        <li
            style={{
                "--stack-top": `${STICK_BASE_REM + index * STICK_STEP_REM}rem`,
            }}
            className="sticky top-(--stack-top) mb-10 last:mb-0"
        >
            <motion.div style={{ scale }} className="origin-top">
                {renderItem(item, index)}
            </motion.div>
        </li>
    );
}

function PinnedStack({ items, renderItem, label, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"],
    });
    return (
        <ol ref={ref} aria-label={label} className={className}>
            {items.map((item, index) => (
                <StackCard
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

function PlainStack({ items, renderItem, label, className }) {
    return (
        <ol aria-label={label} className={cn("flex flex-col gap-6", className)}>
            {items.map((item, index) => (
                <li key={item.id}>{renderItem(item, index)}</li>
            ))}
        </ol>
    );
}

/**
 * Chapter cards that pin one under the other while the next one slides over them (STACK_CARDS, ANIM-46). Earlier
 * cards shrink slightly (`scale` only). `items` is `[{ id, ... }]` (6 at most) and `renderItem(item, index)` renders
 * one opaque card. Every card stays in the DOM in order. Lite and reduced tiers show a plain gapped list.
 */
export function StackedCards({ items, renderItem, label, className }) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const cards = items.slice(0, MAX_CARDS);
    const Stack = tier === "full" ? PinnedStack : PlainStack;
    return (
        <Stack
            items={cards}
            renderItem={renderItem}
            label={label}
            className={className}
        />
    );
}
