import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { JourneySection } from "@/features/marketing/components/JourneySection";
import { expectAccessible } from "@/test/axeCheck";
import {
    MOTION_TIER_CASES,
    setMotionTier,
    stubIntersectionVisible,
} from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("JourneySection", () => {
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
    });

    it.each(MOTION_TIER_CASES)(
        "lists the four stops in order, with the quiz after the first course, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            stubIntersectionVisible();
            renderWithProviders(<JourneySection />);
            const path = screen.getByRole("list", {
                name: "Learning path with a quiz",
            });
            const titles = within(path)
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.textContent);
            expect(titles).toEqual([
                "Data privacy and the DPDP Act",
                "Quiz: data privacy",
                "Python for official statistics",
                "Machine learning basics",
            ]);
            expect(
                screen.getByRole("heading", {
                    level: 2,
                    name: "A path, not a pile of courses.",
                })
            ).toBeInTheDocument();
        }
    );

    it("badges every course source as simulated", () => {
        setMotionTier("reduced");
        renderWithProviders(<JourneySection />);
        expect(screen.getAllByText("Simulated")).toHaveLength(3);
        expect(screen.getAllByText("iGOT Karmayogi")).toHaveLength(2);
        expect(screen.getAllByText("NSSTA TPAC")).toHaveLength(1);
    });

    it("moves the Data privacy level from 2 to 3 at the quiz (final value at once when reduced)", () => {
        setMotionTier("reduced");
        const { container } = renderWithProviders(<JourneySection />);
        const hidden = [...container.querySelectorAll(".sr-only")].map(
            (node) => node.textContent
        );
        expect(hidden).toContain("3");
        const bar = container.querySelector("[data-slot='mock-level-bar']");
        expect(bar.style.getPropertyValue("--level")).toBe("0.6");
        expect(screen.getByText(/needed for the role/)).toBeInTheDocument();
    });

    it("keeps the level at 2 until the quiz stop is seen on the full tier", async () => {
        setMotionTier("full");
        window.IntersectionObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        const { container } = renderWithProviders(<JourneySection />);
        await act(async () => {});
        const bar = container.querySelector("[data-slot='mock-level-bar']");
        expect(bar.style.getPropertyValue("--level")).toBe("0.4");
    });

    it("renders in Hindi", async () => {
        setMotionTier("reduced");
        await act(() => i18n.changeLanguage("hi"));
        renderWithProviders(<JourneySection />);
        expect(
            screen.getByRole("heading", {
                level: 2,
                name: "पाठ्यक्रमों का ढेर नहीं, एक मार्ग।",
            })
        ).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
        setMotionTier("reduced");
        const { container } = renderWithProviders(<JourneySection />);
        await expectAccessible(container);
    });
});
