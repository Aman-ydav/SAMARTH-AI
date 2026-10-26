import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AboutPage from "@/features/marketing/pages/AboutPage";
import {
    ABOUT_PLACEHOLDERS,
    LADDER_LEVELS,
    PRODUCT_FACTS,
    ROADMAP_PHASES,
    TEAM_SLOTS,
    TECH_STACK,
} from "@/features/marketing/data/aboutContent";
import { i18n } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier, stubIntersectionVisible } from "@/test/motionTier";
import { renderPage } from "@/test/pageHarness";

// Long documents and lazily loaded sections are slow under a loaded machine (axe walks the whole page).
vi.setConfig({ testTimeout: 20_000 });

const originalObserver = window.IntersectionObserver;

beforeEach(() => {
    // LazySection mounts a section when it is near the viewport; jsdom has no layout, so report everything visible.
    stubIntersectionVisible();
});

afterEach(async () => {
    window.IntersectionObserver = originalObserver;
    setMotionTier("full");
    await i18n.changeLanguage("en");
});

/** Resolves once the last lazy section (facts and disclaimer) has rendered. */
async function openAbout(t) {
    const view = renderPage(AboutPage, { path: "/about" });
    await screen.findByRole(
        "heading",
        { level: 2, name: t("facts.title") },
        { timeout: 10_000 }
    );
    return view;
}

describe.each(["en", "hi"])("AboutPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
        setMotionTier("reduced");
    });
    const t = (key, options) => i18n.getFixedT(lng, "about")(key, options);

    it("renders one h1, the main landmark and the page title", async () => {
        await openAbout(t);
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            t("hero.title")
        );
        expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
        expect(document.title).toBe(
            `${i18n.getFixedT(lng, "common")("pages.about")} | SAMARTH AI`
        );
    });

    it("keeps the section order of the About rule (ANIM-51)", async () => {
        await openAbout(t);
        const headings = screen
            .getAllByRole("heading", { level: 2 })
            .map((heading) => heading.textContent);
        expect(headings).toEqual([
            t("mission.title"),
            t("problem.title"),
            t("ladder.title"),
            t("principles.title"),
            t("roadmap.title"),
            t("tech.title"),
            t("team.title"),
            t("facts.title"),
        ]);
    });

    it("states the problem statement SIH26101, MoSPI and the theme", async () => {
        await openAbout(t);
        const facts = t("problem.facts", { returnObjects: true });
        for (const fact of facts) {
            expect(screen.getAllByText(fact.value).length).toBeGreaterThan(0);
        }
        expect(screen.getAllByText("SIH26101").length).toBeGreaterThan(0);
    });

    it("lists all six principles", async () => {
        await openAbout(t);
        const items = t("principles.items", { returnObjects: true });
        expect(items).toHaveLength(6);
        for (const item of items) {
            expect(
                screen.getByRole("heading", { level: 3, name: item.title })
            ).toBeInTheDocument();
        }
    });

    it("shows every proficiency level 0 to 5 in the DOM", async () => {
        await openAbout(t);
        const levels = t("ladder.levels", { returnObjects: true });
        expect(levels).toHaveLength(LADDER_LEVELS.length);
        levels.forEach((level, index) => {
            expect(
                screen.getByRole("heading", {
                    level: 3,
                    name: t("ladder.levelTitle", {
                        level: index,
                        name: level.name,
                    }),
                })
            ).toBeInTheDocument();
            expect(screen.getByText(level.summary)).toBeInTheDocument();
        });
    });

    it("shows the project timeline with a status badge per phase", async () => {
        await openAbout(t);
        const phases = t("roadmap.phases", { returnObjects: true });
        expect(phases).toHaveLength(ROADMAP_PHASES.length);
        for (const phase of phases) {
            expect(
                screen.getByRole("heading", { level: 3, name: phase.title })
            ).toBeInTheDocument();
        }
        const status = t("roadmap.status", { returnObjects: true });
        expect(screen.getAllByText(status.done)).toHaveLength(1);
        expect(screen.getAllByText(status.inProgress)).toHaveLength(1);
        expect(screen.getAllByText(status.planned)).toHaveLength(4);
    });

    it("lists the technology chips without logos", async () => {
        await openAbout(t);
        const strip = screen.getByRole("list", { name: t("tech.listLabel") });
        expect(within(strip).getAllByRole("listitem")).toHaveLength(
            TECH_STACK.length
        );
        expect(
            screen.getByText(
                t("tech.aiProvider", {
                    provider: ABOUT_PLACEHOLDERS.llmProvider,
                })
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("flags the six team slots as placeholders, with no real names", async () => {
        const { container } = await openAbout(t);
        const slots = container.querySelectorAll(
            '[data-team-slot="placeholder"]'
        );
        expect(slots).toHaveLength(TEAM_SLOTS.length);
        for (const slot of slots) {
            expect(slot).toHaveTextContent(t("team.placeholderBadge"));
            expect(slot).toHaveTextContent(t("team.namePlaceholder"));
        }
        expect(screen.getByText(t("team.placeholderNote"))).toBeInTheDocument();
        expect(
            screen.getByText(
                t("team.mentor", { mentor: ABOUT_PLACEHOLDERS.mentor })
            )
        ).toBeInTheDocument();
        const roles = t("team.slots", { returnObjects: true });
        for (const { role } of roles) {
            expect(screen.getByText(role)).toBeInTheDocument();
        }
    });

    it("shows only the real product figures and the full disclaimer", async () => {
        await openAbout(t);
        expect(PRODUCT_FACTS.map((fact) => fact.value)).toEqual([4, 43, 6, 10]);
        const figures = screen
            .getAllByRole("definition")
            .map((definition) => definition.textContent)
            .filter((text) => /^\d+$/.test(text));
        expect(figures).toEqual(["4", "43", "6", "10"]);
        expect(screen.getByText(t("disclaimer.body"))).toBeInTheDocument();
    });

    it("passes axe with motion reduced", async () => {
        const { container } = await openAbout(t);
        await expectAccessible(container);
    });
});

describe("AboutPage with the full motion tier", () => {
    beforeEach(() => {
        setMotionTier("full");
    });

    it("renders all content and passes axe", async () => {
        const t = i18n.getFixedT("en", "about");
        const { container } = await openAbout(t);
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
        for (const level of t("ladder.levels", { returnObjects: true })) {
            expect(screen.getByText(level.summary)).toBeInTheDocument();
        }
        await expectAccessible(container);
    });
});
