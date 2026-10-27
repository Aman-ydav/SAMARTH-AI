import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { TOUR_STEP_MS } from "@/lib/motionTokens";

/**
 * Timed product tour for the hero laptop (ANIM-64). Advances one step every `stepMs` and loops, but only while
 * `autoplay` is true, the user has not paused, the pointer or focus is not inside (`hold`), and the referenced
 * element is in view. State changes once per step, never per frame. Returns `[ref, tour]`: the ref to attach to the
 * tour container and the state and setters (kept apart so lint does not mistake the state for a ref).
 */
export function useHeroTour({
    count,
    autoplay,
    initial = 0,
    stepMs = TOUR_STEP_MS,
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { amount: 0.3 });
    const [step, setStep] = useState(initial);
    const [playing, setPlaying] = useState(true);
    const [hold, setHold] = useState(false);
    const running = autoplay && playing && !hold && inView;

    useEffect(() => {
        if (!running) return undefined;
        const timer = setTimeout(
            () => setStep((current) => (current + 1) % count),
            stepMs
        );
        return () => clearTimeout(timer);
    }, [running, step, count, stepMs]);

    return [
        ref,
        {
            step,
            playing,
            running,
            goTo: setStep,
            togglePlaying: () => setPlaying((value) => !value),
            hold: () => setHold(true),
            release: () => setHold(false),
        },
    ];
}
