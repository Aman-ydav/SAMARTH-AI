import { Suspense, lazy, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { DeviceLaptop } from "@/components/motion/DeviceLaptop";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroTourControls } from "@/features/marketing/components/HeroTourControls";
import { TOUR_STEPS } from "@/features/marketing/data/heroMock";
import { useHeroTour } from "@/features/marketing/hooks/useHeroTour";
import { useMotionTier } from "@/hooks/useMotionTier";

/* The screen is the heavy part of the hero (cards, table, fixtures); it loads after first paint (ANIM-61, ANIM-77). */
const MyCompetencyScreen = lazy(() =>
    import("@/features/marketing/components/MyCompetencyScreen").then(
        (module) => ({ default: module.MyCompetencyScreen })
    )
);

const LAST_STEP = TOUR_STEPS.length - 1;

/**
 * Hero product mock (DEVICE_LAPTOP, ANIM-61, ANIM-64): an animated laptop whose screen shows the demo "My competency"
 * page and plays a four-step tour. `full` tier: the lid opens, the screen turns on, then the tour loops (pausable,
 * only while in view, paused on hover and focus). `lite` and `reduced`: an open laptop at the final step, no autoplay,
 * the step buttons still work. The mock is `aria-hidden` and `inert`; the controls are outside it.
 */
export function HeroLaptop() {
    const { t } = useTranslation("landing");
    const full = useMotionTier() === "full";
    const [ready, setReady] = useState(!full);
    const [tourRef, tour] = useHeroTour({
        count: TOUR_STEPS.length,
        autoplay: full && ready,
        initial: full ? 0 : LAST_STEP,
    });
    // Stable identity: DeviceLaptop lists the callback in an effect dependency list.
    const handleScreenOn = useCallback(() => setReady(true), []);

    return (
        <figure
            ref={tourRef}
            onPointerEnter={tour.hold}
            onPointerLeave={tour.release}
            onFocus={tour.hold}
            onBlur={tour.release}
            className="mx-auto flex w-full max-w-2xl flex-col gap-5"
        >
            <figcaption className="sr-only">
                {t("hero.laptop.description")}
            </figcaption>
            <div aria-hidden="true" inert>
                <DeviceLaptop onScreenOn={handleScreenOn}>
                    <Suspense
                        fallback={
                            <Skeleton className="size-full rounded-none" />
                        }
                    >
                        <MyCompetencyScreen step={tour.step} powered={ready} />
                    </Suspense>
                </DeviceLaptop>
            </div>
            <HeroTourControls
                step={tour.step}
                playing={tour.playing}
                showPlayback={full}
                onToggle={tour.togglePlaying}
                onGoTo={tour.goTo}
            />
        </figure>
    );
}
