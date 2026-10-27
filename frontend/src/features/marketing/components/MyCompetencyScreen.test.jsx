import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { MyCompetencyScreen } from "@/features/marketing/components/MyCompetencyScreen";
import { MOCK_COMPETENCIES } from "@/features/marketing/data/heroMock";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const slot = (container, name) => [
    ...container.querySelectorAll(`[data-slot='${name}']`),
];
const highlighted = (container) =>
    container.querySelectorAll("[data-highlighted='true']").length;

/* The screen is only ever shown inside the hidden, inert laptop (ANIM-61), so the test mounts it the same way. */
function renderScreen(props) {
    return renderWithProviders(
        <div aria-hidden="true" inert>
            <MyCompetencyScreen {...props} />
        </div>
    );
}

describe("MyCompetencyScreen", () => {
    beforeEach(() => setMotionTier("reduced"));
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
    });

    it.each(MOTION_TIER_CASES)(
        "shows the whole page on the %s tier: sidebar, top bar, KPIs, levels, gaps, path, feed and sessions",
        (tier) => {
            setMotionTier(tier);
            const { container } = renderScreen();
            expect(container.querySelector("aside")).not.toBeNull();
            expect(container.querySelector("header")).not.toBeNull();
            expect(screen.getByText("Good morning, Asha")).toBeInTheDocument();
            expect(slot(container, "mock-level-bar")).toHaveLength(
                MOCK_COMPETENCIES.length
            );
            for (const title of [
                "Overall readiness",
                "Ranked gaps",
                "Recent activity",
                "Upcoming sessions",
            ]) {
                expect(screen.getByText(title)).toBeInTheDocument();
            }
            expect(screen.getAllByText("Simulated").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
        }
    );

    it("lists eight competencies, five gaps with priorities and a four-item path", () => {
        const { container } = renderScreen();
        expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
        for (const label of ["High", "Medium", "Low"]) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
        expect(container.querySelectorAll("ol > li")).toHaveLength(4);
        expect(screen.getAllByText("iGOT Karmayogi").length).toBeGreaterThan(0);
        expect(screen.getAllByText("NSSTA TPAC").length).toBeGreaterThan(0);
    });

    it("step 1, profile: highlights the KPIs and levels and hides the role requirement", () => {
        const { container } = renderScreen({ step: 0 });
        expect(
            container.querySelector("[data-slot='mock-screen']")
        ).toHaveAttribute("data-step", "profile");
        expect(highlighted(container)).toBe(2);
        expect(slot(container, "mock-level-required")[0]).toHaveClass(
            "opacity-0"
        );
    });

    it("step 2, gaps: highlights the gap table and shows the role requirement", () => {
        const { container } = renderScreen({ step: 1 });
        expect(highlighted(container)).toBe(2);
        expect(slot(container, "mock-level-required")[0]).toHaveClass(
            "opacity-100"
        );
    });

    it("step 3, path: highlights the path card and moves the content up", () => {
        const { container } = renderScreen({ step: 2 });
        expect(highlighted(container)).toBe(1);
        expect(container.querySelector(".-translate-y-32")).not.toBeNull();
    });

    it("step 4, evidence: the quiz shows in the feed and the privacy level and readiness change", () => {
        const { container } = renderScreen({ step: 3 });
        expect(
            container.querySelector("[data-slot='mock-screen']")
        ).toHaveAttribute("data-step", "evidence");
        const quiz = screen
            .getByText("Quiz passed: Data privacy, 8 of 10")
            .closest("div.flex");
        expect(quiz).toHaveClass("opacity-100");
        expect(
            screen.getByText("Learning path ready: 4 items").closest("div.flex")
        ).toHaveClass("opacity-0");
        const readiness = container.querySelectorAll(
            "[data-highlighted] .sr-only"
        );
        expect([...readiness].some((node) => node.textContent === "79%")).toBe(
            true
        );
        expect(screen.getByText("+4")).toHaveClass("opacity-100");
    });

    it("clamps an unknown step to the story range", () => {
        const { container } = renderScreen({ step: 99 });
        expect(
            container.querySelector("[data-slot='mock-screen']")
        ).toHaveAttribute("data-step", "evidence");
        const first = renderScreen({ step: -3 });
        expect(
            first.container.querySelector("[data-slot='mock-screen']")
        ).toHaveAttribute("data-step", "profile");
    });

    it("shows zero figures until the screen is powered", () => {
        const { container } = renderScreen({ step: 0, powered: false });
        const readiness = container.querySelectorAll(
            "[data-highlighted] .sr-only"
        );
        expect([...readiness].some((node) => node.textContent === "0%")).toBe(
            true
        );
        expect(
            slot(container, "mock-level-bar")[0].style.getPropertyValue(
                "--level"
            )
        ).toBe("0");
    });

    it("renders in Hindi", async () => {
        await act(() => i18n.changeLanguage("hi"));
        const { container } = renderScreen();
        expect(
            within(container).getAllByText("मेरी दक्षता").length
        ).toBeGreaterThan(0);
        expect(
            within(container).getByText("उप निदेशक, डेटा विश्लेषक भूमिका")
        ).toBeInTheDocument();
    });

    it("uses only transform and opacity transitions and token colours", () => {
        const { container } = renderScreen();
        const html = container.innerHTML;
        expect(html).not.toMatch(
            /transition-all|shadow|gradient|blur|animate-pulse/
        );
        expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
    });

    it("has no axe violations", async () => {
        const { container } = renderScreen();
        await expectAccessible(container);
    });
});
