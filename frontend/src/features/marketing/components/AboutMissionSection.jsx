import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextReveal } from "@/components/motion/TextReveal";

/** Mission statement, revealed word by word on scroll (ANIM-51, third). */
export function AboutMissionSection() {
    const { t } = useTranslation("about");
    const missionId = useId();

    return (
        <section
            aria-labelledby={missionId}
            className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 md:py-20 lg:px-8"
        >
            <h2 id={missionId} className="type-overline text-primary-text">
                {t("mission.title")}
            </h2>
            <TextReveal
                text={t("mission.statement")}
                className="type-display mt-4 text-balance"
            />
        </section>
    );
}
