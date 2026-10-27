import { lazy } from "react";
import { useTranslation } from "react-i18next";
import { HeroAboutSection } from "@/features/marketing/components/HeroAboutSection";
import { LazySection } from "@/features/marketing/components/LazySection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/* Everything below the hero loads on demand (ANIM-77); order follows ANIM-51. Each loader maps the named export to a default. */
const named = (load, name) =>
    lazy(() => load().then((module) => ({ default: module[name] })));

const AboutStory = named(
    () => import("@/features/marketing/components/AboutStorySection"),
    "AboutStorySection"
);
const AboutMission = named(
    () => import("@/features/marketing/components/AboutMissionSection"),
    "AboutMissionSection"
);
const Acronym = named(
    () => import("@/features/marketing/components/AcronymSection"),
    "AcronymSection"
);
const AboutHow = named(
    () => import("@/features/marketing/components/AboutHowSection"),
    "AboutHowSection"
);
const AboutLadder = named(
    () => import("@/features/marketing/components/AboutLadderSection"),
    "AboutLadderSection"
);
const AboutPrinciples = named(
    () => import("@/features/marketing/components/AboutPrinciplesSection"),
    "AboutPrinciplesSection"
);
const AboutRoadmap = named(
    () => import("@/features/marketing/components/AboutRoadmapSection"),
    "AboutRoadmapSection"
);
const AboutTech = named(
    () => import("@/features/marketing/components/AboutTechSection"),
    "AboutTechSection"
);
const AboutDevelopers = named(
    () => import("@/features/marketing/components/AboutDevelopersSection"),
    "AboutDevelopersSection"
);
const AboutDisclaimer = named(
    () => import("@/features/marketing/components/AboutDisclaimerSection"),
    "AboutDisclaimerSection"
);

const SECTIONS = [
    { id: "story", component: AboutStory, reserve: "min-h-svh" },
    { id: "mission", component: AboutMission, reserve: "min-h-96" },
    { id: "acronym", component: Acronym, reserve: "min-h-svh" },
    { id: "how", component: AboutHow, reserve: "min-h-svh" },
    { id: "ladder", component: AboutLadder, reserve: "min-h-svh" },
    { id: "principles", component: AboutPrinciples, reserve: "min-h-96" },
    { id: "roadmap", component: AboutRoadmap, reserve: "min-h-svh" },
    { id: "tech", component: AboutTech, reserve: "min-h-64" },
    { id: "developers", component: AboutDevelopers, reserve: "min-h-96" },
    { id: "disclaimer", component: AboutDisclaimer, reserve: "min-h-96" },
];

/**
 * `/about` (docs/23 section 4, ANIM-51): the story of the product. Hero, why we built it (drawn timeline), mission,
 * the SAMARTH acronym, how we built it (stacked chapters), ladder, principles, roadmap, technology, the developers,
 * and the product facts with the prototype disclaimer.
 */
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
