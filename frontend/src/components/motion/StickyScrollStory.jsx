import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useMotionTier } from "@/hooks/useMotionTier";
import { cn } from "@/lib/utils";

function StepText({ step, index, active }) {
    return (
        <div
            className={cn(
                "flex max-w-md flex-col gap-3 transition-opacity duration-300 motion-reduce:transition-none",
                active ? "opacity-100" : "opacity-40"
            )}
        >
            <span className="font-mono type-small tabular-nums text-primary-text">
                {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="type-h3 text-foreground">{step.title}</h3>
            <p className="type-body-lg text-muted-foreground">{step.body}</p>
        </div>
    );
}

function PinnedStory({ steps, renderVisual, className }) {
    const ref = useRef(null);
    const [active, setActive] = useState(0);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start center", "end center"],
    });

    useMotionValueEvent(scrollYProgress, "change", (progress) => {
        const next = Math.min(
            steps.length - 1,
            Math.max(0, Math.floor(progress * steps.length))
        );
        setActive((current) => (current === next ? current : next));
    });

    return (
        <div
            ref={ref}
            className={cn(
                "grid items-start gap-8 md:grid-cols-2 md:gap-16",
                className
            )}
        >
            <ol>
                {steps.map((step, index) => (
                    <li
                        key={step.id}
                        className="flex min-h-[45svh] items-center"
                    >
                        <StepText
                            step={step}
                            index={index}
                            active={index === active}
                        />
                    </li>
                ))}
            </ol>
            <div
                aria-hidden="true"
                inert
                className="sticky top-0 grid h-svh place-items-center"
            >
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={cn(
                            "col-start-1 row-start-1 w-full transition-opacity duration-300 motion-reduce:transition-none",
                            index === active
                                ? "opacity-100"
                                : "pointer-events-none opacity-0"
                        )}
                    >
                        {renderVisual(step, index, index === active)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function StackedStory({ steps, renderVisual, className }) {
    return (
        <ol className={cn("flex flex-col gap-12", className)}>
            {steps.map((step, index) => (
                <li
                    key={step.id}
                    className="grid items-center gap-6 md:grid-cols-2 md:gap-16"
                >
                    <StepText step={step} index={index} active />
                    <div aria-hidden="true" inert>
                        {renderVisual(step, index, true)}
                    </div>
                </li>
            ))}
        </ol>
    );
}

/**
 * Sticky stage with text steps that swap the visual while scrolling (ANIM-34). `steps` is
 * `[{ id, title, body }]` in reading order and `renderVisual(step, index, active)` returns the decorative visual (`active` is true for the
 * current step, always true when stacked, so a visual can animate when its step comes into focus). Visuals are `inert`.
 * Every step text stays in the DOM in order; React state changes only when the active step number changes.
 * Lite and reduced tiers stack each step with its visual.
 */
export function StickyScrollStory({ steps, renderVisual, className }) {
    const tier = useMotionTier();
    if (!steps?.length) return null;
    const Story = tier === "full" ? PinnedStory : StackedStory;
    return (
        <Story
            steps={steps}
            renderVisual={renderVisual}
            className={className}
        />
    );
}
