import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { StickyScrollStory } from "@/components/motion/StickyScrollStory";
import { Button } from "@/components/ui/button";
import { HowStepVisual } from "@/features/marketing/components/HowStepVisual";
import {
    HOW_STEP_IDS,
    LANDING_LINKS,
} from "@/features/marketing/data/landingContent";

/** Four-step story (STICKY_STORY): text steps scroll, the flat visual beside them swaps. */
export function HowItWorksSection() {
    const { t } = useTranslation("landing");
    const steps = HOW_STEP_IDS.map((id) => ({
        id,
        title: t(`how.steps.${id}.title`),
        body: t(`how.steps.${id}.body`),
    }));

    return (
        <section aria-labelledby="how-title" className="py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <h2
                    id="how-title"
                    className="type-h1 max-w-3xl text-foreground"
                >
                    {t("how.title")}
                </h2>
                <StickyScrollStory
                    className="mt-10"
                    steps={steps}
                    renderVisual={(step) => <HowStepVisual id={step.id} />}
                />
                <div className="mt-10">
                    <Button asChild size="lg">
                        <Link to={LANDING_LINKS.getStarted}>
                            {t("how.cta")}
                            <ArrowRightIcon aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
