import { useTranslation } from "react-i18next";
import { TickerMarquee } from "@/components/motion/TickerMarquee";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import {
    ABOUT_PLACEHOLDERS,
    TECH_STACK,
} from "@/features/marketing/data/aboutContent";

/** Technology strip (ANIM-51, sixth): the stack as text chips in a ticker with a pause control, no logos or endorsements. */
export function AboutTechSection() {
    const { t } = useTranslation("about");
    return (
        <AboutSectionShell title={t("tech.title")} intro={t("tech.intro")}>
            <TickerMarquee
                items={[...TECH_STACK]}
                ariaLabel={t("tech.listLabel")}
                pauseLabel={t("tech.pause")}
                playLabel={t("tech.play")}
            />
            <p className="type-small mt-4 text-muted-foreground">
                {t("tech.aiProvider", {
                    provider: ABOUT_PLACEHOLDERS.llmProvider,
                })}
            </p>
        </AboutSectionShell>
    );
}
