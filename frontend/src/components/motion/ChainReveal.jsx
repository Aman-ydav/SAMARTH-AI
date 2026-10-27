import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

const MAX_BLOCKS = 6;
const SPAN = 0.7;
const BLOCK_FADE = 0.14;
const RISE_PX = 12;

const linkClass =
    "mx-auto h-4 w-0.5 shrink-0 origin-left bg-primary sm:mx-0 sm:h-0.5 sm:w-6";

function DrivenBlock({ item, index, count, progress, renderItem }) {
    const start = (index / count) * SPAN;
    const opacity = useTransform(progress, [start, start + BLOCK_FADE], [0, 1]);
    const y = useTransform(progress, [start, start + BLOCK_FADE], [RISE_PX, 0]);
    const scaleX = useTransform(progress, [start - BLOCK_FADE, start], [0, 1]);
    return (
        <li className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center">
            {index > 0 ? (
                <motion.span
                    aria-hidden="true"
                    style={{ scaleX }}
                    className={linkClass}
                />
            ) : null}
            <motion.div style={{ opacity, y }} className="min-w-0 flex-1">
                {renderItem(item, index)}
            </motion.div>
        </li>
    );
}

function StaticBlock({ item, index, renderItem }) {
    return (
        <li className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center">
            {index > 0 ? (
                <span aria-hidden="true" className={linkClass} />
            ) : null}
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
        </li>
    );
}

function DrivenChain({ items, renderItem, label, className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 85%", "end 55%"],
    });
    return (
        <ol
            ref={ref}
            aria-label={label}
            className={cn("flex flex-col items-stretch sm:flex-row", className)}
        >
            {items.map((item, index) => (
                <DrivenBlock
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

function StaticChain({ items, renderItem, label, className }) {
    return (
        <ol
            aria-label={label}
            className={cn("flex flex-col items-stretch sm:flex-row", className)}
        >
            {items.map((item, index) => (
                <StaticBlock
                    key={item.id}
                    item={item}
                    index={index}
                    renderItem={renderItem}
                />
            ))}
        </ol>
    );
}

/**
 * Blocks that appear one after another with the link between two blocks drawn by scroll (CHAIN_REVEAL, ANIM-48).
 * Blocks use `opacity` and a small `y`, links use `scaleX`. `items` is `[{ id, ... }]` (6 at most) and
 * `renderItem(item, index)` renders one block. Every block stays in the DOM in order; lite and reduced tiers show the
 * whole chain. Not pinned. Decorative unless the caller adds a caption.
 */
export function ChainReveal({ items, renderItem, label, className }) {
    const tier = useMotionTier();
    if (!items?.length) return null;
    const Chain = tier === "full" ? DrivenChain : StaticChain;
    return (
        <Chain
            items={items.slice(0, MAX_BLOCKS)}
            renderItem={renderItem}
            label={label}
            className={className}
        />
    );
}
