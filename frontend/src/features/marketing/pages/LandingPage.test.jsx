import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import LandingPage from "@/features/marketing/pages/LandingPage";
import { expectAccessible } from "@/test/axeCheck";
import {
    MOTION_TIER_CASES,
    setMotionTier,
    stubIntersectionVisible,
} from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const SECTION_TITLES_EN = [
    "The problem we are solving",
    "Seven ideas, one name.",
    "From profile to progress in four steps.",
    "A look inside the prototype",
    "Built for four kinds of users.",
    "The framework at a glance.",
    "Security and privacy by design.",
    "Standards and frameworks this prototype is designed around. Not certifications or endorsements.",
    "Frequently asked questions",
    "Start with your own competency profile.",
];

/* The page owns its single <main>; the layout around it renders none. */
function Layout() {
    return <LandingPage />;
}

const SECTION_MODULES = [
    "ProblemSection",
    "AcronymSection",
    "HowItWorksSection",
    "TourSection",
    "RolesSection",
    "FrameworkSection",
    "TrustSection",
    "StandardsSection",
    "FaqSection",
    "CtaSection",
];

// Lazy sections resolve through dynamic imports; a loaded CI machine needs more than the 1 s default.
const LOAD_TIMEOUT_MS = 15000;

async function renderLanding() {
    const result = renderWithProviders(<Layout />);
    await screen.findByRole(
        "heading",
        { level: 2, name: /Start with your own competency profile/ },
        { timeout: LOAD_TIMEOUT_MS }
    );
    return result;
}

// Each test mounts ten lazy sections (dynamic imports, motion, i18n); the 5 s default is too tight on a loaded machine.
describe("LandingPage", { timeout: 30000 }, () => {
    // Warm the lazy section modules once so the first render test measures the page, not the module graph.
    beforeAll(async () => {
        await Promise.all(
            SECTION_MODULES.map(
                (name) =>
                    import(
                        /* @vite-ignore */ `/src/features/marketing/components/${name}.jsx`
                    )
            )
        );
    }, 60000);

    beforeEach(async () => {
        await act(() => i18n.changeLanguage("en"));
        setMotionTier("reduced");
        stubIntersectionVisible();
    });
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
        document.head.innerHTML = "";
    });

    it("renders every section heading in the ANIM-50 order", async () => {
        await renderLanding();
        const titles = screen
            .getAllByRole("heading", { level: 2 })
            .map((heading) => heading.textContent);
        expect(titles).toEqual(SECTION_TITLES_EN);
    });

    it("has exactly one h1 and a main landmark with the skip target id", async () => {
        const { container } = await renderLanding();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        const main = screen.getByRole("main");
        expect(main).toHaveAttribute("id", "main-content");
        expect(main).toHaveAttribute("tabindex", "-1");
        expect(container.querySelectorAll("main")).toHaveLength(1);
    });

    it("exposes the #how, #security and #faq anchors", async () => {
        const { container } = await renderLanding();
        for (const id of ["how", "security", "faq"]) {
            expect(container.querySelector(`#${id}`), id).not.toBeNull();
        }
    });

    it("links the primary CTAs to /get-started and /login", async () => {
        await renderLanding();
        const getStarted = screen.getAllByRole("link", {
            name: /^Get started/,
        });
        expect(getStarted.length).toBeGreaterThanOrEqual(3);
        for (const link of getStarted)
            expect(link).toHaveAttribute("href", "/get-started");
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(
            screen.getByRole("link", { name: /Read the Privacy Policy/ })
        ).toHaveAttribute("href", "/privacy");
    });

    it("shows all seven SAMARTH letters with honest status badges", async () => {
        await renderLanding();
        const cards = screen
            .getAllByRole("heading", { level: 3 })
            .map((h) => h.textContent);
        for (const word of [
            "Skill assessment",
            "Adaptive learning",
            "Mapping competencies",
            "AI-driven analytics",
            "Recommendations",
            "Training pathways",
            "Holistic capacity building",
        ]) {
            expect(cards).toContain(word);
        }
        expect(screen.getByText("Planned")).toBeInTheDocument();
        expect(screen.getAllByText("Partly planned")).toHaveLength(2);
        expect(screen.getByText("Simulated data")).toBeInTheDocument();
    });

    it("shows the four how-it-works steps, five tour panels and four roles", async () => {
        await renderLanding();
        for (const step of [
            "Build your profile",
            "See your gaps",
            "Follow your path",
            "Prove and update",
        ]) {
            expect(
                screen.getByRole("heading", { level: 3, name: step })
            ).toBeInTheDocument();
        }
        expect(
            screen.getByText(
                /In this prototype the iGOT Karmayogi and NSSTA data are simulated/
            )
        ).toBeInTheDocument();
        for (const role of ["Learner", "Trainer", "Admin", "Platform admin"]) {
            expect(
                screen.getByRole("heading", { level: 3, name: role })
            ).toBeInTheDocument();
        }
        expect(screen.getAllByText("Demo data").length).toBeGreaterThanOrEqual(
            5
        );
    });

    it("shows only real framework figures", async () => {
        await renderLanding();
        const figures = screen
            .getByRole("heading", { name: "The framework at a glance." })
            .closest("section");
        const text = figures.textContent;
        for (const value of ["4", "43", "6", "10"])
            expect(text).toContain(value);
        expect(text).toContain("Behavioural and managerial");
        expect(
            screen.getByText(
                /Seed framework and role requirements are proposed defaults/
            )
        ).toBeInTheDocument();
    });

    it("answers every FAQ question inside an accordion", async () => {
        await renderLanding();
        const faq = screen
            .getByRole("heading", { name: "Frequently asked questions" })
            .closest("section");
        expect(within(faq).getAllByRole("button")).toHaveLength(10);
        expect(
            within(faq).getByRole("button", {
                name: "Is SAMARTH AI an official government website?",
            })
        ).toBeInTheDocument();
    });

    it("shows the full prototype disclaimer under the final CTA", async () => {
        await renderLanding();
        expect(
            screen.getByText(
                /SAMARTH AI is a student prototype built in response to Smart India Hackathon/
            )
        ).toBeInTheDocument();
    });

    it("sets the page title, canonical link and JSON-LD for / (without fake ratings)", async () => {
        await renderLanding();
        await waitFor(() =>
            expect(document.title).toBe(
                "SAMARTH AI | Competency Intelligence for Official Statistics"
            )
        );
        expect(
            document.head.querySelector('link[rel="canonical"]')
        ).toHaveAttribute("href", `${window.location.origin}/`);
        const script = document.head.querySelector(
            'script[type="application/ld+json"]'
        );
        const graph = JSON.parse(script.textContent)["@graph"];
        expect(graph.map((node) => node["@type"])).toEqual([
            "WebSite",
            "SoftwareApplication",
            "FAQPage",
        ]);
        expect(script.textContent).not.toMatch(/aggregateRating/);
        expect(graph[2].mainEntity).toHaveLength(10);
    });

    it.each(MOTION_TIER_CASES)(
        "renders every section on the %s tier",
        async (tier) => {
            setMotionTier(tier);
            await renderLanding();
            expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(
                SECTION_TITLES_EN.length
            );
            expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(
                1
            );
        }
    );

    it("renders the Hindi copy and Hindi head tags when the language is hi", async () => {
        await act(() => i18n.changeLanguage("hi"));
        renderWithProviders(<Layout />);
        expect(
            await screen.findByRole(
                "heading",
                {
                    level: 1,
                    name: "वे कौशल बनाएँ, जिन पर आधिकारिक सांख्यिकी टिकी है।",
                },
                { timeout: LOAD_TIMEOUT_MS }
            )
        ).toBeInTheDocument();
        expect(
            await screen.findByRole(
                "heading",
                { level: 2, name: "सात विचार, एक नाम।" },
                { timeout: LOAD_TIMEOUT_MS }
            )
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                document.head.querySelector('meta[property="og:locale"]')
            ).toHaveAttribute("content", "hi_IN")
        );
    });

    it("keeps the nav-less landing page free of axe violations", async () => {
        const { container } = await renderLanding();
        await expectAccessible(container);
    });
});
