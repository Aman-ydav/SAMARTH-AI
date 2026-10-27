import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { MeasureSection } from "@/features/marketing/components/MeasureSection";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("MeasureSection", () => {
    afterEach(async () => {
        await act(() => i18n.changeLanguage("en"));
    });

    it.each(MOTION_TIER_CASES)(
        "tells the measured and compared beats with six meters on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = renderWithProviders(<MeasureSection />);
            expect(
                screen.getByRole("heading", {
                    level: 2,
                    name: "Skills are invisible until they are measured.",
                })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { level: 3, name: "Measured" })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { level: 3, name: "Compared" })
            ).toBeInTheDocument();
            expect(container.querySelectorAll("ul > li")).toHaveLength(6);
            expect(screen.getByText("Demo data")).toBeInTheDocument();
            expect(screen.getByText("Current level")).toBeInTheDocument();
            expect(
                screen.getByText("Required for the role")
            ).toBeInTheDocument();
        }
    );

    it("keeps every final level and gap for assistive technology", () => {
        setMotionTier("full");
        const { container } = renderWithProviders(<MeasureSection />);
        const hidden = [...container.querySelectorAll(".sr-only")].map(
            (node) => node.textContent
        );
        expect(hidden).toContain("4 / 4 ");
        expect(hidden).toContain("2 / 4 Gap 2");
        expect(hidden).toContain("1 / 3 Gap 2");
    });

    it("starts every meter unmeasured on the full tier and shows the finished state on reduced", () => {
        setMotionTier("full");
        const full = renderWithProviders(<MeasureSection />);
        const marks = [
            ...full.container.querySelectorAll("li > [aria-hidden='true'].w-6"),
        ];
        expect(marks.map((node) => node.textContent)).toEqual(
            Array(6).fill("?")
        );
        full.unmount();
        setMotionTier("reduced");
        const reduced = renderWithProviders(<MeasureSection />);
        const numbers = [
            ...reduced.container.querySelectorAll(
                "li > [aria-hidden='true'].w-6"
            ),
        ];
        expect(numbers.map((node) => node.textContent)).toEqual([
            "4",
            "3",
            "3",
            "2",
            "1",
            "2",
        ]);
    });

    it("renders in Hindi", async () => {
        setMotionTier("reduced");
        await act(() => i18n.changeLanguage("hi"));
        renderWithProviders(<MeasureSection />);
        expect(
            screen.getByRole("heading", {
                level: 2,
                name: "कौशल तब तक अदृश्य हैं, जब तक उन्हें मापा न जाए।",
            })
        ).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
        setMotionTier("reduced");
        const { container } = renderWithProviders(<MeasureSection />);
        await expectAccessible(container);
    });
});
