import { lazy } from "react";
import { HeroSection } from "@/features/marketing/components/HeroSection";
import { LandingSeo } from "@/features/marketing/components/LandingSeo";
import { LazySection } from "@/features/marketing/components/LazySection";
import { LANDING_SECTION_IDS } from "@/features/marketing/data/landingContent";

/* Everything below the hero loads on demand (ANIM-77). Each loader maps the named export to a default for lazy(). */
const ProblemSection = lazy(() =>
    import("@/features/marketing/components/ProblemSection").then((module) => ({
        default: module.ProblemSection,
    }))
);
const AcronymSection = lazy(() =>
    import("@/features/marketing/components/AcronymSection").then((module) => ({
        default: module.AcronymSection,
    }))
);
const HowItWorksSection = lazy(() =>
    import("@/features/marketing/components/HowItWorksSection").then(
        (module) => ({ default: module.HowItWorksSection })
    )
);
const TourSection = lazy(() =>
    import("@/features/marketing/components/TourSection").then((module) => ({
        default: module.TourSection,
    }))
);
const RolesSection = lazy(() =>
    import("@/features/marketing/components/RolesSection").then((module) => ({
        default: module.RolesSection,
    }))
);
const FrameworkSection = lazy(() =>
    import("@/features/marketing/components/FrameworkSection").then(
        (module) => ({ default: module.FrameworkSection })
    )
);
const TrustSection = lazy(() =>
    import("@/features/marketing/components/TrustSection").then((module) => ({
        default: module.TrustSection,
    }))
);
const StandardsSection = lazy(() =>
    import("@/features/marketing/components/StandardsSection").then(
        (module) => ({ default: module.StandardsSection })
    )
);
const FaqSection = lazy(() =>
    import("@/features/marketing/components/FaqSection").then((module) => ({
        default: module.FaqSection,
    }))
);
const CtaSection = lazy(() =>
    import("@/features/marketing/components/CtaSection").then((module) => ({
        default: module.CtaSection,
    }))
);

/**
 * Landing page (docs/23 section 3, ANIM-50 order): hero, problem, acronym spiral, how it works, product tour,
 * role views, framework wheel, trust, standards ticker, FAQ, final CTA. Every page owns its single
 * <main id="main-content">; MarketingLayout supplies the nav, footer, Lenis and progress bar only.
 * Hero is static; the rest mounts 600 px before it is seen.
 */
export default function LandingPage() {
    return (
        <main id="main-content" tabIndex={-1}>
            <LandingSeo />
            <HeroSection />
            <LazySection component={ProblemSection} reserve="min-h-[60svh]" />
            <LazySection component={AcronymSection} reserve="min-h-[200svh]" />
            <LazySection
                id={LANDING_SECTION_IDS.how}
                component={HowItWorksSection}
                reserve="min-h-[200svh]"
            />
            <LazySection
                id={LANDING_SECTION_IDS.features}
                component={TourSection}
                reserve="min-h-[205svh]"
            />
            <LazySection component={RolesSection} reserve="min-h-[200svh]" />
            <LazySection component={FrameworkSection} reserve="min-h-svh" />
            <LazySection
                id={LANDING_SECTION_IDS.security}
                component={TrustSection}
                reserve="min-h-svh"
            />
            <LazySection component={StandardsSection} reserve="min-h-40" />
            <LazySection
                id={LANDING_SECTION_IDS.faq}
                component={FaqSection}
                reserve="min-h-svh"
            />
            <LazySection component={CtaSection} reserve="min-h-[70svh]" />
        </main>
    );
}
