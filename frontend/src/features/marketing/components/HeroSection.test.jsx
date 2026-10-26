import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HeroSection } from "@/features/marketing/components/HeroSection";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const TITLE = "Build the skills that official statistics runs on.";

describe("HeroSection", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "shows the H1 and both CTAs on the %s tier",
        (tier) => {
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

    it("builds the product mock from components, hidden and inert, with a description", () => {
        const { container } = renderWithProviders(<HeroSection />);
        const mock = container.querySelector("figure [inert]");
        expect(mock).toHaveAttribute("aria-hidden", "true");
        expect(container.querySelector("img")).toBeNull();
        expect(
            screen.getByText(
                /Sample learner dashboard showing a competency radar chart/
            )
        ).toHaveClass("sr-only");
        expect(mock.querySelector("[data-slot='progress']")).not.toBeNull();
        expect(mock.querySelector("table")).not.toBeNull();
    });

    it("wraps the mock in the pinned zoom stage on the full tier only", () => {
        const { container, unmount } = renderWithProviders(<HeroSection />);
        expect(container.querySelector(".sticky")).not.toBeNull();
        unmount();
        setMotionTier("lite");
        const lite = renderWithProviders(<HeroSection />);
        expect(lite.container.querySelector(".sticky")).toBeNull();
    });

    it("has no axe violations", async () => {
        const { container } = renderWithProviders(<HeroSection />);
        await expectAccessible(container);
    });
});
