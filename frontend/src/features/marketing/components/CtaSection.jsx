import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { Button } from "@/components/ui/button";
import { LANDING_LINKS } from "@/features/marketing/data/landingContent";

const BAR_HEIGHTS = ["h-24", "h-40", "h-56"];

/** Flat ascending bars, echoing the brand mark's competency levels (decorative parallax layer). */
function LevelBars() {
    return (
        <ParallaxLayer
            distance={80}
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 lg:block"
        >
            <div className="flex h-full items-end justify-end gap-3 pr-8 pb-8">
                {BAR_HEIGHTS.map((height, index) => (
                    <span
                        key={height}
                        className={`${height} w-10 rounded-md ${index === BAR_HEIGHTS.length - 1 ? "bg-primary" : "bg-accent"}`}
                    />
                ))}
            </div>
        </ParallaxLayer>
    );
}

/** Final call to action (TEXT_REVEAL, flat PARALLAX bars, REVEAL_ON_VIEW) with the full prototype disclaimer. */
export function CtaSection() {
    const { t } = useTranslation("landing");

    return (
        <section aria-labelledby="cta-title" className="py-12 md:py-20">
            <div className="relative mx-auto max-w-7xl overflow-clip rounded-lg border border-border bg-card px-6 py-16 sm:px-10 md:py-24">
                <LevelBars />
                <div className="relative flex max-w-2xl flex-col items-start gap-6">
                    <TextReveal
                        as="h2"
                        text={t("cta.title")}
                        className="type-display text-card-foreground"
                    />
                    <Reveal
                        as="p"
                        className="type-body-lg text-muted-foreground"
                    >
                        {t("cta.sub")}
                    </Reveal>
                    <Reveal className="flex flex-wrap gap-3" delay={0.08}>
                        <Button asChild size="lg">
                            <Link to={LANDING_LINKS.getStarted}>
                                {t("cta.primary")}
                                <ArrowRightIcon aria-hidden="true" />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <Link to={LANDING_LINKS.login}>
                                {t("cta.secondary")}
                            </Link>
                        </Button>
                    </Reveal>
                    <p className="type-small text-muted-foreground">
                        {t("cta.disclaimer")}
                    </p>
                </div>
            </div>
        </section>
    );
}
