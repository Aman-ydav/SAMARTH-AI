import { useRef } from "react";
import { useInView } from "motion/react";
import { ValueTick } from "@/components/motion/ValueTick";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";
import { MOCK_COMPETENCIES } from "@/features/marketing/data/heroMock";
import { useMotionTier } from "@/hooks/useMotionTier";

const PRIVACY = MOCK_COMPETENCIES.find((item) => item.id === "privacy");

/**
 * Level card inside the quiz stop of the journey (story beat 5, VALUE_TICK): when the stop comes into view the
 * Data privacy level ticks from its starting value to the value after the quiz and the bar moves. Reduced motion
 * shows the final value at once.
 */
export function JourneyLevel({ t }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.8 });
    const reduced = useMotionTier() === "reduced";
    const after = inView || reduced;
    const level = after ? PRIVACY.evidenceLevel : PRIVACY.current;

    return (
        <div
            ref={ref}
            className="mt-3 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card p-4"
        >
            <div className="flex items-baseline justify-between gap-3">
                <span className="type-small font-medium text-card-foreground">
                    {t("journey.level.title")}
                </span>
                <span className="type-caption text-muted-foreground">
                    {t("journey.level.label")}{" "}
                    <ValueTick
                        className="type-h4 text-foreground"
                        value={level}
                        initial={PRIVACY.current}
                    />{" "}
                    / {PRIVACY.required}
                </span>
            </div>
            <MockLevelBar level={level} required={PRIVACY.required} />
            <span className="type-caption text-muted-foreground">
                {PRIVACY.required} {t("journey.level.needed")}
            </span>
        </div>
    );
}
