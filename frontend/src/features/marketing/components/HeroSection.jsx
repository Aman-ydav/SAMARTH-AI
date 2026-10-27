import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { TickerMarquee } from "@/components/motion/TickerMarquee";
import { Button } from "@/components/ui/button";
import { HeroLaptop } from "@/features/marketing/components/HeroLaptop";
import { LANDING_LINKS } from "@/features/marketing/data/landingContent";

/**
 * Landing hero (ANIM-60): two columns from `lg`. Left: load-reveal H1, sub-headline, two CTAs, the prototype note and
 * the skills ticker. Right: the animated laptop with the product tour (ANIM-64). Below `lg` the laptop sits under the
 * copy. Statically imported (ANIM-77); the heavy laptop screen inside it loads lazily.
 */
export function HeroSection() {
    const { t } = useTranslation("landing");
    const chips = t("hero.tickerChips", { returnObjects: true });

    return (
        <section>
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-12 sm:px-6 md:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-2 lg:gap-10 lg:px-8">
                <div className="flex min-w-0 flex-col gap-10">
                    <div className="flex flex-col items-start gap-6">
                        <p className="type-overline text-primary-text uppercase">
                            {t("hero.eyebrow")}
                        </p>
                        <TextReveal
                            as="h1"
                            mode="load"
                            text={t("hero.title")}
                            className="type-display-xl max-w-4xl text-foreground lg:type-display"
                        />
                        <Reveal
                            as="p"
                            className="max-w-xl type-body-lg text-muted-foreground"
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
                    <TickerMarquee
                        items={Array.isArray(chips) ? chips : []}
                        ariaLabel={t("hero.tickerLabel")}
                        pauseLabel={t("ticker.pause")}
                        playLabel={t("ticker.play")}
                    />
                </div>
                <HeroLaptop />
            </div>
        </section>
    );
}
