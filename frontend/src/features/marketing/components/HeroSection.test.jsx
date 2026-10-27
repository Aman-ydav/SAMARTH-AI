import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HeroSection } from "@/features/marketing/components/HeroSection";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const TITLE = "Build the skills that official statistics runs on.";
const SCREEN_TIMEOUT = { timeout: 15000 };

async function renderHero() {
    const result = renderWithProviders(<HeroSection />);
    await result.findByText("Recent activity", {}, SCREEN_TIMEOUT);
    return result;
}

describe("HeroSection", { timeout: 30000 }, () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "shows the H1 and both CTAs on the %s tier",
        async (tier) => {
            setMotionTier(tier);
            renderWithProviders(<HeroSection />);
            expect(
                screen.getByRole("heading", { level: 1, name: TITLE })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("link", { name: /^Get started/ })
            ).toHaveAttribute("href", "/get-started");
            expect(
                screen.getByRole("link", { name: "See how it works" })
            ).toHaveAttribute("href", "#how");
            await screen.findByText("Recent activity", {}, SCREEN_TIMEOUT);
        }
    );

    it("shows the sub-headline, the prototype note and the eyebrow", () => {
        renderWithProviders(<HeroSection />);
        expect(
            screen.getByText(/maps every official's competencies to their role/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "Prototype for SIH26101. Not an official Government of India website."
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "Smart Competency Intelligence for Official Statistics"
            )
        ).toBeInTheDocument();
    });

    it("has a skills ticker with a visible pause control", () => {
        renderWithProviders(<HeroSection />);
        const ticker = screen.getByRole("group", {
            name: "Skill areas the platform covers",
        });
        expect(within(ticker).getAllByText("Sampling").length).toBeGreaterThan(
            0
        );
        expect(
            within(ticker).getByRole("button", {
                name: "Pause the scrolling chips",
            })
        ).toBeInTheDocument();
    });

    it("is two columns from lg: copy and ticker first, the laptop second", () => {
        const { container } = renderWithProviders(<HeroSection />);
        const grid = container.querySelector(".lg\\:grid-cols-2");
        expect(grid).not.toBeNull();
        const [copy, laptop] = grid.children;
        expect(copy).toContainElement(
            screen.getByRole("heading", { level: 1 })
        );
        expect(copy).toContainElement(
            screen.getByRole("group", {
                name: "Skill areas the platform covers",
            })
        );
        expect(laptop.tagName).toBe("FIGURE");
        expect(copy.compareDocumentPosition(laptop)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    });

    it("replaces the zoom stage: no pinned track in the hero", () => {
        const { container } = renderWithProviders(<HeroSection />);
        expect(container.querySelector(".sticky")).toBeNull();
    });

    it("builds the laptop from components, hidden and inert, with a description and no brand", async () => {
        const { container } = await renderHero();
        const mock = container.querySelector("figure [inert]");
        expect(mock).toHaveAttribute("aria-hidden", "true");
        expect(container.querySelector("img")).toBeNull();
        expect(
            screen.getByText(/Sample learner web app shown on a laptop/)
        ).toHaveClass("sr-only");
        expect(mock.querySelector("[data-slot='progress']")).not.toBeNull();
        expect(mock.querySelector("table")).not.toBeNull();
        expect(container.textContent).not.toMatch(/macbook|apple/i);
    });

    it("shows the full My competency page on the screen", async () => {
        const { container } = await renderHero();
        const screenEl = container.querySelector("[data-slot='mock-screen']");
        for (const text of [
            "My competency",
            "Overall readiness",
            "Competencies assessed",
            "Open gaps",
            "Learning hours",
            "Learning streak",
            "Competency levels",
            "Ranked gaps",
            "Learning path",
            "Recent activity",
            "Upcoming sessions",
            "Demo data",
        ]) {
            expect(
                within(screenEl).getAllByText(text).length,
                text
            ).toBeGreaterThan(0);
        }
        expect(
            screenEl.querySelectorAll("[data-slot='mock-level-bar']")
        ).toHaveLength(8);
    });

    it("keeps the tour controls outside the inert mock and tells the story step by step", async () => {
        const { container } = await renderHero();
        const controls = screen.getByRole("group", { name: "Product tour" });
        expect(container.querySelector("[inert]")).not.toContainElement(
            controls
        );
        expect(within(controls).getAllByRole("button")).toHaveLength(5);
        expect(within(controls).getByText("Step 1 of 4")).toBeInTheDocument();
        fireEvent.click(
            within(controls).getByRole("button", {
                name: "Show step 3: A path is recommended",
            })
        );
        expect(within(controls).getByText("Step 3 of 4")).toBeInTheDocument();
        expect(
            within(controls).getByText(
                "Courses are ordered by the gap they close."
            )
        ).toBeInTheDocument();
        expect(
            container.querySelector("[data-slot='mock-screen']")
        ).toHaveAttribute("data-step", "path");
        expect(
            container.querySelector("[data-highlighted='true']")
        ).toBeInTheDocument();
    });

    it("offers pause and play on the full tier", async () => {
        await renderHero();
        const pause = screen.getByRole("button", {
            name: "Pause the product tour",
        });
        fireEvent.click(pause);
        expect(
            screen.getByRole("button", { name: "Play the product tour" })
        ).toBeInTheDocument();
    });

    it.each(["reduced", "lite"])(
        "shows the open laptop at the final step on the %s tier, without autoplay",
        async (tier) => {
            setMotionTier(tier);
            const { container } = await renderHero();
            expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
            expect(
                container.querySelector("[data-slot='mock-screen']")
            ).toHaveAttribute("data-step", "evidence");
            expect(
                screen.queryByRole("button", { name: /product tour/ })
            ).toBeNull();
            expect(
                container.querySelector("[data-state='animated']")
            ).toBeNull();
            expect(
                screen.getByText(
                    "A passed quiz moves Data privacy from level 2 to 3."
                )
            ).toBeInTheDocument();
        }
    );

    it("has no axe violations", async () => {
        const { container } = await renderHero();
        await expectAccessible(container);
    });
});
