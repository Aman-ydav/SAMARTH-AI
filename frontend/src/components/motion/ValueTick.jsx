import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { useTranslation } from "react-i18next";
import { useMotionTier } from "@/hooks/useMotionTier";
import { formatNumber } from "@/lib/format";
import { DURATION, EASE } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

/**
 * A figure that ticks from its previous value to the new one whenever `value` changes (VALUE_TICK, ANIM-49).
 * It starts at `initial` (default: no tick on mount), is driven by a MotionValue and written to the DOM (no
 * per-frame state), uses mono tabular figures and Latin digits via Intl, and carries an `sr-only` final value.
 * `suffix` is appended to the visible and the hidden text (for example a percent sign). Under reduced motion the
 * final value shows at once.
 */
export function ValueTick({
    value,
    initial = value,
    suffix = "",
    duration = DURATION.count,
    className,
}) {
    const tier = useMotionTier();
    const { i18n } = useTranslation();
    const language = i18n.language;
    const reduced = tier === "reduced";
    const ref = useRef(null);
    const motionValue = useMotionValue(reduced ? value : initial);
    const text = (number) =>
        `${formatNumber(Math.round(number), language)}${suffix}`;

    useMotionValueEvent(motionValue, "change", (latest) => {
        if (ref.current) ref.current.textContent = text(latest);
    });

    useEffect(() => {
        if (reduced) {
            motionValue.set(value);
            return undefined;
        }
        const controls = animate(motionValue, value, {
            duration,
            ease: EASE.out,
        });
        return () => controls.stop();
    }, [value, reduced, duration, motionValue]);

    return (
        <span className={cn("font-mono tabular-nums", className)}>
            <span ref={ref} aria-hidden="true">
                {text(reduced ? value : initial)}
            </span>
            <span className="sr-only">{text(value)}</span>
        </span>
    );
}
