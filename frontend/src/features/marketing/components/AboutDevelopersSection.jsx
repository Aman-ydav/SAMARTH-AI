import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import { DeveloperCard } from "@/features/marketing/components/DeveloperCard";
import { ABOUT_PLACEHOLDERS } from "@/features/marketing/data/aboutContent";
import { DEVELOPERS } from "@/features/marketing/data/developers";

const STAGGER_SECONDS = 0.06;

/**
 * The developers (ANIM-51, tenth): six cards from `data/developers.js`, shown with the placeholder note while any
 * entry is still a placeholder. Names, photos and links are never invented here (docs/23 section 8).
 */
export function AboutDevelopersSection() {
    const { t } = useTranslation("about");
    const anyPlaceholder = DEVELOPERS.some(
        (developer) => developer.placeholder
    );

    return (
        <AboutSectionShell
            title={t("developers.title")}
            intro={t("developers.intro")}
        >
            {anyPlaceholder ? (
                <p className="type-small mb-6 text-muted-foreground">
                    {t("developers.placeholderNote")}
                </p>
            ) : null}
            <ul
                aria-label={t("developers.listLabel")}
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
                {DEVELOPERS.map((developer, index) => (
                    <Reveal
                        as="li"
                        key={developer.id}
                        delay={index * STAGGER_SECONDS}
                    >
                        <DeveloperCard developer={developer} />
                    </Reveal>
                ))}
            </ul>
            <p className="type-small mt-6 text-muted-foreground">
                {t("developers.mentor", { mentor: ABOUT_PLACEHOLDERS.mentor })}
            </p>
        </AboutSectionShell>
    );
}
