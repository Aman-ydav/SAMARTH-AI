import { useTranslation } from "react-i18next";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { ScrollRotate } from "@/components/motion/ScrollRotate";
import {
    FRAMEWORK_DOMAINS,
    FRAMEWORK_FIGURES,
} from "@/features/marketing/data/landingContent";
import { formatNumber } from "@/lib/format";

function DomainChip({ domain, t, language }) {
    return (
        <div className="min-w-28 rounded-md border border-border bg-card px-3 py-2 text-center">
            <p className="type-small font-medium text-card-foreground">
                {t(`framework.domains.${domain.id}`)}
            </p>
            <p className="font-mono type-small tabular-nums text-muted-foreground">
                {formatNumber(domain.count, language)}
            </p>
        </div>
    );
}

/** Framework at a glance: real figures counting up (COUNT_UP) and the four domains on a rotating ring (SCROLL_ROTATE). */
export function FrameworkSection() {
    const { t, i18n } = useTranslation("landing");

    return (
        <section aria-labelledby="framework-title" className="py-12 md:py-20">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
                <div className="flex flex-col gap-8">
                    <h2
                        id="framework-title"
                        className="type-h1 max-w-xl text-foreground"
                    >
                        {t("framework.title")}
                    </h2>
                    <dl className="grid grid-cols-2 gap-6">
                        {FRAMEWORK_FIGURES.map((figure, index) => (
                            <Reveal
                                key={figure.id}
                                delay={index * 0.08}
                                className="flex flex-col gap-1 border-t border-border pt-4"
                            >
                                <dt className="order-2 type-small text-muted-foreground">
                                    {t(`framework.figures.${figure.id}`)}
                                </dt>
                                <dd className="order-1">
                                    <CountUp
                                        value={figure.value}
                                        className="type-stat text-foreground"
                                    />
                                </dd>
                            </Reveal>
                        ))}
                    </dl>
                    <p className="type-small text-muted-foreground">
                        {t("framework.footnote")}
                    </p>
                </div>
                <div role="group" aria-label={t("framework.ringLabel")}>
                    <ScrollRotate
                        items={FRAMEWORK_DOMAINS}
                        renderItem={(domain) => (
                            <DomainChip
                                domain={domain}
                                t={t}
                                language={i18n.language}
                            />
                        )}
                    >
                        <p className="max-w-32 text-center type-small text-muted-foreground">
                            {t("framework.ringLabel")}
                        </p>
                    </ScrollRotate>
                </div>
            </div>
        </section>
    );
}
