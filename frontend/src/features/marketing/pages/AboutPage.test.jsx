import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/app/routes";
import AboutPage from "@/features/marketing/pages/AboutPage";
import {
    ABOUT_PLACEHOLDERS,
    BUILD_CHAPTERS,
    LADDER_LEVELS,
    PRODUCT_FACTS,
    ROADMAP_PHASES,
    STORY_STOPS,
    TECH_STACK,
} from "@/features/marketing/data/aboutContent";
import { DEVELOPERS } from "@/features/marketing/data/developers";
import { i18n } from "@/i18n";
import { anonymousAuth } from "@/test/authState";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier, stubIntersectionVisible } from "@/test/motionTier";
import { renderPage } from "@/test/pageHarness";
import { renderRoutes } from "@/test/renderWithProviders";

// Long documents and lazily loaded sections are slow under a loaded machine (axe walks the whole page).
vi.setConfig({ testTimeout: 30_000 });

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
        { timeout: 15_000 }
    );
    return view;
}

const section = (container, id) => container.querySelector(`#about-${id}`);

describe.each(["en", "hi"])("AboutPage (%s)", (lng) => {
    beforeEach(async () => {
        await i18n.changeLanguage(lng);
        setMotionTier("reduced");
    });
    const t = (key, options) => i18n.getFixedT(lng, "about")(key, options);
    const tl = (key, options) => i18n.getFixedT(lng, "landing")(key, options);

    it("renders one h1 with the story headline, the main landmark and the page title", async () => {
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

    it("keeps the section order of the About rule (ANIM-51), one h2 per section", async () => {
        const { container } = await openAbout(t);
        const headings = screen
            .getAllByRole("heading", { level: 2 })
            .map((heading) => heading.textContent);
        expect(headings).toEqual([
            t("story.title"),
            t("mission.title"),
            tl("acronym.title"),
            t("how.title"),
            t("ladder.title"),
            t("principles.title"),
            t("roadmap.title"),
            t("tech.title"),
            t("developers.title"),
            t("facts.title"),
        ]);
        const ids = [...container.querySelectorAll("main > div[id^='about-']")]
            .map((node) => node.id)
            .filter(Boolean);
        expect(ids).toEqual([
            "about-story",
            "about-mission",
            "about-acronym",
            "about-how",
            "about-ladder",
            "about-principles",
            "about-roadmap",
            "about-tech",
            "about-developers",
            "about-disclaimer",
        ]);
    });

    it("tells the SIH26101 story as five ordered steps with the problem statement facts", async () => {
        const { container } = await openAbout(t);
        const story = within(section(container, "story"));
        const stops = t("story.stops", { returnObjects: true });
        expect(stops).toHaveLength(STORY_STOPS.length);
        const list = story.getByRole("list", {
            name: t("story.timelineLabel"),
        });
        expect(
            within(list)
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.textContent)
        ).toEqual(stops.map((stop) => stop.title));
        for (const stop of stops)
            expect(story.getByText(stop.body)).toBeInTheDocument();
        expect(story.getByText("SIH26101")).toBeInTheDocument();
        expect(story.getByText("MoSPI")).toBeInTheDocument();
        expect(
            story.getByText(t("story.facts", { returnObjects: true })[2].value)
        ).toBeInTheDocument();
    });

    it("reuses the SAMARTH acronym section with its seven letter cards in order", async () => {
        const { container } = await openAbout(t);
        const acronym = within(section(container, "acronym"));
        const words = ["s", "a1", "m", "a2", "r", "t", "h"].map((id) =>
            tl(`acronym.cards.${id}.word`)
        );
        expect(
            acronym
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.textContent)
        ).toEqual(words);
        const title = acronym.getByRole("heading", { level: 2 });
        expect(
            section(container, "acronym").querySelector("section")
        ).toHaveAttribute("aria-labelledby", title.id);
    });

    it("lists the five build chapters in order, each with a status and its highlights", async () => {
        const { container } = await openAbout(t);
        const how = within(section(container, "how"));
        const chapters = t("how.chapters", { returnObjects: true });
        expect(chapters).toHaveLength(BUILD_CHAPTERS.length);
        const list = how.getByRole("list", { name: t("how.listLabel") });
        expect(
            within(list)
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.textContent)
        ).toEqual(chapters.map((chapter) => chapter.title));
        for (const chapter of chapters) {
            expect(how.getByText(chapter.body)).toBeInTheDocument();
            for (const point of chapter.points)
                expect(how.getByText(point)).toBeInTheDocument();
        }
        const status = t("roadmap.status", { returnObjects: true });
        expect(within(list).getAllByText(status.done)).toHaveLength(1);
        expect(within(list).getAllByText(status.inProgress)).toHaveLength(3);
        expect(within(list).getAllByText(status.planned)).toHaveLength(1);
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

    it("shows the project roadmap with a status badge per phase", async () => {
        const { container } = await openAbout(t);
        const roadmap = within(section(container, "roadmap"));
        const phases = t("roadmap.phases", { returnObjects: true });
        expect(phases).toHaveLength(ROADMAP_PHASES.length);
        for (const phase of phases) {
            expect(
                roadmap.getByRole("heading", { level: 3, name: phase.title })
            ).toBeInTheDocument();
        }
        const status = t("roadmap.status", { returnObjects: true });
        expect(roadmap.getAllByText(status.done)).toHaveLength(1);
        expect(roadmap.getAllByText(status.inProgress)).toHaveLength(1);
        expect(roadmap.getAllByText(status.planned)).toHaveLength(4);
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

    it("shows six clearly marked developer placeholders, no links and no real names", async () => {
        const { container } = await openAbout(t);
        const developers = within(section(container, "developers"));
        const cards = container.querySelectorAll("[data-developer]");
        expect(cards).toHaveLength(6);
        expect(
            container.querySelectorAll("[data-developer-placeholder='true']")
        ).toHaveLength(6);
        DEVELOPERS.forEach((developer, index) => {
            const card = cards[index];
            expect(card).toHaveAttribute("data-developer", developer.id);
            expect(
                within(card).getByRole("heading", {
                    level: 3,
                    name: `Developer ${index + 1}`,
                })
            ).toBeInTheDocument();
            expect(card).toHaveTextContent(t("developers.placeholderBadge"));
        });
        expect(
            developers.getByText(t("developers.placeholderNote"))
        ).toBeInTheDocument();
        expect(
            developers.getByText(
                t("developers.mentor", { mentor: ABOUT_PLACEHOLDERS.mentor })
            )
        ).toBeInTheDocument();
        expect(developers.queryByRole("link")).not.toBeInTheDocument();
        expect(developers.queryByRole("img")).not.toBeInTheDocument();
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

describe("AboutPage motion tiers", () => {
    const t = i18n.getFixedT("en", "about");

    it("full: pins the build chapters, draws the story line and keeps all content", async () => {
        setMotionTier("full");
        const { container } = await openAbout(t);
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
        expect(
            section(container, "how").querySelectorAll("li.sticky")
        ).toHaveLength(BUILD_CHAPTERS.length);
        expect(
            section(container, "story").querySelector(".origin-top")
        ).not.toBeNull();
        for (const level of t("ladder.levels", { returnObjects: true }))
            expect(screen.getByText(level.summary)).toBeInTheDocument();
        await expectAccessible(container);
    });

    it.each(["lite", "reduced"])(
        "%s: build chapters and story are static and complete",
        async (tier) => {
            setMotionTier(tier);
            const { container } = await openAbout(t);
            expect(
                section(container, "how").querySelector(".sticky")
            ).toBeNull();
            expect(
                section(container, "story").querySelector("[style]")
            ).toBeNull();
            for (const chapter of t("how.chapters", { returnObjects: true }))
                expect(screen.getByText(chapter.body)).toBeInTheDocument();
            for (const stop of t("story.stops", { returnObjects: true }))
                expect(screen.getByText(stop.body)).toBeInTheDocument();
            await expectAccessible(container);
        }
    );
});

describe("/about route", () => {
    it("renders inside the marketing frame with About as the current navbar link", async () => {
        setMotionTier("reduced");
        renderRoutes(routes, {
            route: "/about",
            preloadedState: { auth: anonymousAuth },
        });
        const t = i18n.getFixedT("en", "about");
        expect(
            await screen.findByRole(
                "heading",
                { level: 1, name: t("hero.title") },
                { timeout: 15_000 }
            )
        ).toBeInTheDocument();
        const nav = screen.getByRole("navigation", { name: "Main navigation" });
        expect(
            within(nav).getByRole("link", { name: "About" })
        ).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });
});
