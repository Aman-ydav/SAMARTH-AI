import { useTranslation } from "react-i18next";
import { TickerMarquee } from "@/components/motion/TickerMarquee";

/** Standards and frameworks the prototype is designed around, as a text-chip ticker with a visible pause button. */
export function StandardsSection() {
    const { t } = useTranslation("landing");
    const chips = t("standards.chips", { returnObjects: true });

    return (
        <section aria-labelledby="standards-title" className="py-12">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
                <h2
                    id="standards-title"
                    className="max-w-3xl type-body text-muted-foreground"
                >
                    {t("standards.label")}
                </h2>
                <TickerMarquee
                    items={Array.isArray(chips) ? chips : []}
                    speed={50}
                    ariaLabel={t("standards.label")}
                    pauseLabel={t("ticker.pause")}
                    playLabel={t("ticker.play")}
                />
            </div>
        </section>
    );
}
