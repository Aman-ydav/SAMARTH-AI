import { useTranslation } from "react-i18next";
import { SpiralCards3D } from "@/components/motion/SpiralCards3D";
import { Badge } from "@/components/ui/badge";
import { ACRONYM_CARDS } from "@/features/marketing/data/landingContent";

function AcronymCard({ card, t }) {
    return (
        <article className="flex h-48 flex-col gap-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
                <span
                    aria-hidden="true"
                    className="font-display text-5xl leading-none text-primary-text"
                >
                    {card.letter}
                </span>
                {card.status ? (
                    <Badge variant="secondary">
                        {t(`acronym.status.${card.status}`)}
                    </Badge>
                ) : null}
            </div>
            <h3 className="type-h4 text-card-foreground">
                {t(`acronym.cards.${card.id}.word`)}
            </h3>
            <p className="type-small text-muted-foreground">
                {t(`acronym.cards.${card.id}.text`)}
            </p>
        </article>
    );
}

/** SAMARTH acronym: seven cards in S-A-M-A-R-T-H order on a 3D spiral (SPIRAL_3D, pinned). */
export function AcronymSection() {
    const { t } = useTranslation("landing");

    return (
        <section aria-labelledby="acronym-title">
            <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 md:pt-20 lg:px-8">
                <h2
                    id="acronym-title"
                    className="type-h1 max-w-3xl text-foreground"
                >
                    {t("acronym.title")}
                </h2>
                <p className="mt-4 max-w-2xl type-body-lg text-muted-foreground">
                    {t("acronym.sub")}
                </p>
            </div>
            <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 md:pb-20 lg:px-8">
                <SpiralCards3D
                    items={ACRONYM_CARDS}
                    renderItem={(card) => <AcronymCard card={card} t={t} />}
                />
            </div>
        </section>
    );
}
