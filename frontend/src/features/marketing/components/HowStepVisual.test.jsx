import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { HowStepVisual } from "@/features/marketing/components/HowStepVisual";
import { HOW_STEP_IDS } from "@/features/marketing/data/landingContent";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const WINDOW_TITLES = {
    profile: "Onboarding",
    gaps: "Gap analysis",
    path: "Learning path",
    evidence: "Evidence",
};

const bars = (container) => [
    ...container.querySelectorAll("[data-slot='mock-level-bar']"),
];
const level = (bar) => bar.style.getPropertyValue("--level");
const hiddenValues = (container) =>
    [...container.querySelectorAll(".sr-only")].map((node) => node.textContent);

/* Visuals are decorative: the story column marks them aria-hidden and inert. */
function renderVisual(id, active = true) {
    return renderWithProviders(
        <div aria-hidden="true" inert>
            <HowStepVisual id={id} active={active} />
        </div>
    );
}

describe("HowStepVisual", () => {
    beforeEach(() => setMotionTier("reduced"));
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
    });

    it.each(HOW_STEP_IDS)(
        "%s: a titled application window marked as demo data",
        (id) => {
            const { container } = renderVisual(id);
            const frame = container.querySelector("[data-slot='mock-window']");
            expect(
                within(frame).getByText(WINDOW_TITLES[id])
            ).toBeInTheDocument();
            expect(within(frame).getByText("Demo data")).toBeInTheDocument();
        }
    );

    it("renders nothing for an unknown step", () => {
        const { container } = renderWithProviders(<HowStepVisual id="nope" />);
        expect(container).toBeEmptyDOMElement();
    });

    describe("profile (estimated starting levels)", () => {
        it("pairs an onboarding form with live results", () => {
            const { container } = renderVisual("profile");
            expect(screen.getByText("Designation")).toBeInTheDocument();
            expect(screen.getByText("Role")).toBeInTheDocument();
            expect(
                screen.getAllByText("Deputy Director").length
            ).toBeGreaterThan(0);
            expect(
                screen.getByRole("button", {
                    name: "Fewer years",
                    hidden: true,
                })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "More years", hidden: true })
            ).toBeInTheDocument();
            expect(screen.getByText("12")).toBeInTheDocument();
            expect(screen.getByText("M.Sc. Statistics")).toBeInTheDocument();
            expect(
                screen.getByText("Survey methods workshop")
            ).toBeInTheDocument();
            expect(
                screen.getByText("Estimated starting levels")
            ).toBeInTheDocument();
            expect(screen.getByText("Live estimate")).toBeInTheDocument();
            expect(
                container.querySelectorAll("[data-slot='select-trigger']")
            ).toHaveLength(2);
        });

        it("shows six competency rows with level, confidence and the role marker", () => {
            const { container } = renderVisual("profile");
            expect(bars(container)).toHaveLength(6);
            expect(screen.getAllByText("High").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Low").length).toBeGreaterThan(0);
            expect(
                screen.getByText("Required for the role")
            ).toBeInTheDocument();
            expect(
                container.querySelector("[data-slot='mock-level-required']")
            ).toHaveClass("opacity-100");
        });

        it("starts empty and fills when the step becomes active", () => {
            const idle = renderVisual("profile", false);
            expect(
                bars(idle.container).every((bar) => level(bar) === "0")
            ).toBe(true);
            expect(
                idle.container.querySelector(
                    "[data-slot='mock-level-required']"
                )
            ).toHaveClass("opacity-0");
            idle.unmount();
            const active = renderVisual("profile", true);
            expect(
                bars(active.container).some((bar) => level(bar) !== "0")
            ).toBe(true);
        });
    });

    describe("gaps", () => {
        it("lists the ranked gaps with the reason and a priority badge", () => {
            const { container } = renderVisual("gaps");
            expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
            expect(
                screen.getAllByText("2 below the role level, importance high")
                    .length
            ).toBe(2);
            expect(screen.getAllByText("High").length).toBe(2);
            expect(
                screen.getByText(/Priority is the gap times/)
            ).toBeInTheDocument();
        });

        it("shows the difference to the role level only when active", () => {
            const idle = renderVisual("gaps", false);
            expect(
                idle.container.querySelector(
                    "[data-slot='mock-level-required']"
                )
            ).toHaveClass("opacity-0");
            idle.unmount();
            const active = renderVisual("gaps", true);
            expect(
                active.container.querySelector(
                    "[data-slot='mock-level-required']"
                )
            ).toHaveClass("opacity-100");
        });
    });

    describe("path", () => {
        it("shows four ordered stops with simulated sources and the total time", () => {
            const { container } = renderVisual("path");
            expect(container.querySelectorAll("ol > li")).toHaveLength(4);
            expect(screen.getAllByText("Simulated")).toHaveLength(4);
            expect(
                screen.getAllByText("iGOT Karmayogi").length
            ).toBeGreaterThan(0);
            expect(screen.getAllByText("NSSTA TPAC").length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Closes the gap in/).length).toBe(4);
            expect(hiddenValues(container)).toContain("25 h");
        });

        it("draws the connecting line with scale when active", () => {
            const idle = renderVisual("path", false);
            expect(idle.container.querySelector(".origin-top")).toHaveClass(
                "scale-y-0"
            );
            idle.unmount();
            const active = renderVisual("path", true);
            expect(active.container.querySelector(".origin-top")).toHaveClass(
                "scale-y-100"
            );
        });
    });

    describe("evidence", () => {
        it("moves the level and the readiness figure once active", () => {
            const idle = renderVisual("evidence", false);
            expect(hiddenValues(idle.container)).toEqual(
                expect.arrayContaining(["2", "75%"])
            );
            idle.unmount();
            const active = renderVisual("evidence", true);
            expect(hiddenValues(active.container)).toEqual(
                expect.arrayContaining(["3", "79%"])
            );
        });

        it("lists the new evidence and the refreshed recommendations", () => {
            renderVisual("evidence");
            expect(
                screen.getByText("Quiz passed: Data privacy, 8 of 10")
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    "Course completed: Data privacy and the DPDP Act"
                )
            ).toBeInTheDocument();
            expect(
                screen.getByText("Recommendations refreshed")
            ).toBeInTheDocument();
        });
    });

    it("renders the profile visual in Hindi", async () => {
        await act(() => i18n.changeLanguage("hi"));
        renderVisual("profile");
        expect(screen.getByText("अनुमानित शुरुआती स्तर")).toBeInTheDocument();
        expect(screen.getByText("एम.एससी. सांख्यिकी")).toBeInTheDocument();
    });

    it.each(HOW_STEP_IDS)("%s: no axe violations", async (id) => {
        const { container } = renderVisual(id);
        await expectAccessible(container);
    });
});
