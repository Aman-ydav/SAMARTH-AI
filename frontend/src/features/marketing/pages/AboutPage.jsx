import { lazy } from "react";
import { useTranslation } from "react-i18next";
import { HeroAboutSection } from "@/features/marketing/components/HeroAboutSection";
import { LazySection } from "@/features/marketing/components/LazySection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/* Everything below the hero loads on demand (ANIM-77); order follows ANIM-51. Loaders map the named export to a default. */
const AboutMission = lazy(() =>
    import("@/features/marketing/components/AboutMissionSection").then(
        (module) => ({ default: module.AboutMissionSection })
    )
);
const AboutLadder = lazy(() =>
    import("@/features/marketing/components/AboutLadderSection").then(
        (module) => ({ default: module.AboutLadderSection })
    )
);
const AboutPrinciples = lazy(() =>
    import("@/features/marketing/components/AboutPrinciplesSection").then(
        (module) => ({ default: module.AboutPrinciplesSection })
    )
);
const AboutRoadmap = lazy(() =>
    import("@/features/marketing/components/AboutRoadmapSection").then(
        (module) => ({ default: module.AboutRoadmapSection })
    )
);
const AboutTech = lazy(() =>
    import("@/features/marketing/components/AboutTechSection").then(
        (module) => ({ default: module.AboutTechSection })
    )
);
const AboutTeam = lazy(() =>
    import("@/features/marketing/components/AboutTeamSection").then(
        (module) => ({ default: module.AboutTeamSection })
    )
);
const AboutDisclaimer = lazy(() =>
    import("@/features/marketing/components/AboutDisclaimerSection").then(
        (module) => ({ default: module.AboutDisclaimerSection })
    )
);

const SECTIONS = [
    { id: "mission", component: AboutMission, reserve: "min-h-96" },
    { id: "ladder", component: AboutLadder, reserve: "min-h-svh" },
    { id: "principles", component: AboutPrinciples, reserve: "min-h-96" },
    { id: "roadmap", component: AboutRoadmap, reserve: "min-h-svh" },
    { id: "tech", component: AboutTech, reserve: "min-h-64" },
    { id: "team", component: AboutTeam, reserve: "min-h-96" },
    { id: "disclaimer", component: AboutDisclaimer, reserve: "min-h-96" },
];

/** `/about` (docs/23 section 4, ANIM-51): hero, mission and problem, ladder, principles, timeline, technology, team, facts and disclaimer. */
export default function AboutPage() {
    const { t } = useTranslation("common");
    useDocumentTitle(t("documentTitle", { page: t("pages.about") }));

    return (
        <main id="main-content" tabIndex={-1}>
            <HeroAboutSection />
            {SECTIONS.map(({ id, component, reserve }) => (
                <LazySection
                    key={id}
                    id={`about-${id}`}
                    component={component}
                    reserve={reserve}
                />
            ))}
        </main>
    );
}
