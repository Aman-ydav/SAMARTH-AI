import { useEffect, useRef } from "react";
import {
    animate,
    useInView,
    useMotionValue,
    useMotionValueEvent,
} from "motion/react";
import { useTranslation } from "react-i18next";
import { useMotionTier } from "@/hooks/useMotionTier";
import { formatNumber } from "@/lib/format";
import { DURATION, EASE } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

function AnimatedCount({ value, language, duration, className }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.6 });
    const count = useMotionValue(0);

    useMotionValueEvent(count, "change", (latest) => {
        if (ref.current)
            ref.current.textContent = formatNumber(
                Math.round(latest),
                language
            );
    });

    useEffect(() => {
        if (!inView) return undefined;
        const controls = animate(count, value, {
            duration,
            ease: EASE.out,
        });
        return () => controls.stop();
    }, [inView, count, value, duration]);

    return (
        <span className={cn("font-mono tabular-nums", className)}>
            <span ref={ref} aria-hidden="true">
                {formatNumber(0, language)}
            </span>
            <span className="sr-only">{formatNumber(value, language)}</span>
        </span>
    );
}

/**
 * Counts a real figure from 0 once when seen (ANIM-41). Driven by a MotionValue (no per-frame state), formatted
 * with Intl (`en-IN` / `hi-IN`, Latin digits), mono tabular figures, and an `sr-only` final value.
 * Only pass figures that exist in the product or docs. Shows the final value under reduced motion.
 */
export function CountUp({ value, duration = DURATION.count, className }) {
    const tier = useMotionTier();
    const { i18n } = useTranslation();
    if (tier === "reduced") {
        return (
            <span className={cn("font-mono tabular-nums", className)}>
                {formatNumber(value, i18n.language)}
            </span>
        );
    }
    return (
        <AnimatedCount
            value={value}
            language={i18n.language}
            duration={duration}
            className={className}
        />
    );
}
