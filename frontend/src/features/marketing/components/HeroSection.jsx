import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { TickerMarquee } from "@/components/motion/TickerMarquee";
import { ZoomScrollSection } from "@/components/motion/ZoomScrollSection";
import { Button } from "@/components/ui/button";
import { HeroProductMock } from "@/features/marketing/components/HeroProductMock";
import { LANDING_LINKS } from "@/features/marketing/data/landingContent";

/**
 * Landing hero (ANIM-60): load-reveal H1, sub-headline, two CTAs, the skills ticker on the bottom edge of the
 * first viewport and, below it, the product mock inside a zoom + tilt scroll section. Statically imported (ANIM-77).
 */
export function HeroSection() {
    const { t } = useTranslation("landing");
    const chips = t("hero.tickerChips", { returnObjects: true });

    return (
        <section>
            <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col px-4 pt-12 sm:px-6 md:pt-20 lg:px-8">
                <div className="flex flex-1 flex-col items-start justify-center gap-6 pb-12">
                    <p className="type-overline text-primary-text uppercase">
                        {t("hero.eyebrow")}
                    </p>
                    <TextReveal
                        as="h1"
                        mode="load"
                        text={t("hero.title")}
                        className="type-display-xl max-w-4xl text-foreground"
                    />
                    <Reveal
                        as="p"
                        className="max-w-2xl type-body-lg text-muted-foreground"
                    >
                        {t("hero.sub")}
                    </Reveal>
                    <Reveal className="flex flex-wrap gap-3" delay={0.08}>
                        <Button asChild size="lg">
                            <Link to={LANDING_LINKS.getStarted}>
                                {t("hero.ctaPrimary")}
                                <ArrowRightIcon aria-hidden="true" />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <a href={LANDING_LINKS.howAnchor}>
                                {t("hero.ctaSecondary")}
                            </a>
                        </Button>
                    </Reveal>
                    <p className="type-small text-muted-foreground">
                        {t("hero.note")}
                    </p>
                </div>
                <div className="pb-6">
                    <TickerMarquee
                        items={Array.isArray(chips) ? chips : []}
                        ariaLabel={t("hero.tickerLabel")}
                        pauseLabel={t("ticker.pause")}
                        playLabel={t("ticker.play")}
                    />
                </div>
            </div>
            <ZoomScrollSection>
                <div className="px-4 sm:px-6 lg:px-8">
                    <HeroProductMock />
                </div>
            </ZoomScrollSection>
        </section>
    );
}
