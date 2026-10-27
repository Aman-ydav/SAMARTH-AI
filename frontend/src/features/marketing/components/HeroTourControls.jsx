import { useTranslation } from "react-i18next";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/features/marketing/data/heroMock";

/**
 * Step label, story text, pause/play and step buttons under the hero laptop (ANIM-64, WCAG 2.2.2). They sit outside
 * the inert mock so keyboard and screen-reader users can use them. `showPlayback` is false when nothing autoplays.
 */
export function HeroTourControls({
    step,
    playing,
    showPlayback,
    onToggle,
    onGoTo,
}) {
    const { t } = useTranslation("landing");
    const current = TOUR_STEPS[step];
    const title = (id) => t(`hero.laptop.steps.${id}.title`);

    return (
        <div
            role="group"
            aria-label={t("hero.laptop.controls.label")}
            className="flex flex-col gap-3"
        >
            <div className="flex min-h-24 items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="type-overline text-primary-text uppercase">
                        {t("hero.laptop.stepLabel", {
                            current: step + 1,
                            total: TOUR_STEPS.length,
                        })}
                    </p>
                    <p className="mt-1 type-h4 text-foreground">
                        {title(current.id)}
                    </p>
                    <p className="mt-1 type-small text-muted-foreground">
                        {t(`hero.laptop.steps.${current.id}.body`)}
                    </p>
                </div>
                {showPlayback ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={onToggle}
                        aria-label={
                            playing
                                ? t("hero.laptop.controls.pause")
                                : t("hero.laptop.controls.play")
                        }
                    >
                        {playing ? (
                            <PauseIcon aria-hidden="true" />
                        ) : (
                            <PlayIcon aria-hidden="true" />
                        )}
                    </Button>
                ) : null}
            </div>
            <ol className="flex gap-2">
                {TOUR_STEPS.map((item, index) => (
                    <li key={item.id}>
                        <Button
                            type="button"
                            size="icon"
                            variant={index === step ? "default" : "outline"}
                            aria-current={index === step ? "step" : undefined}
                            aria-label={t("hero.laptop.controls.goTo", {
                                step: index + 1,
                                title: title(item.id),
                            })}
                            onClick={() => onGoTo(index)}
                        >
                            {index + 1}
                        </Button>
                    </li>
                ))}
            </ol>
        </div>
    );
}
