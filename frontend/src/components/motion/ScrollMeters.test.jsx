import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollMeters } from "@/components/motion/ScrollMeters";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

const ROWS = [
    { id: "a", label: "Sampling", value: 4, required: 4 },
    { id: "b", label: "Privacy", value: 2, required: 4 },
    { id: "c", label: "Machine learning", value: 1, required: 3 },
];
const gapLabel = (gap) => `Gap ${gap}`;

function renderMeters(props) {
    return renderWithProviders(
        <ScrollMeters rows={ROWS} gapLabel={gapLabel} {...props} />
    );
}

describe("ScrollMeters", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every row with its final value and gap for assistive technology on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = renderMeters();
            expect(screen.getAllByRole("listitem")).toHaveLength(ROWS.length);
            for (const row of ROWS) {
                expect(screen.getByText(row.label)).toBeInTheDocument();
            }
            const hidden = [...container.querySelectorAll(".sr-only")].map(
                (node) => node.textContent
            );
            expect(hidden).toEqual(["4 / 4 ", "2 / 4 Gap 2", "1 / 3 Gap 2"]);
        }
    );

    it("starts from the unknown mark and no gap on the full tier", () => {
        const { container } = renderMeters({ unknown: "?" });
        const numbers = [
            ...container.querySelectorAll("li > [aria-hidden='true'].w-6"),
        ];
        expect(numbers.map((node) => node.textContent)).toEqual([
            "?",
            "?",
            "?",
        ]);
    });

    it("shows the final numbers and the gap text on the reduced tier", () => {
        setMotionTier("reduced");
        const { container } = renderMeters();
        const numbers = [
            ...container.querySelectorAll("li > [aria-hidden='true'].w-6"),
        ];
        expect(numbers.map((node) => node.textContent)).toEqual([
            "4",
            "2",
            "1",
        ]);
        expect(
            screen.getAllByText("Gap 2", { selector: "span.type-caption" })
        ).toHaveLength(2);
    });

    it("scales bars on X from tokens and never sets a width", () => {
        setMotionTier("reduced");
        const { container } = renderMeters();
        expect(
            container.querySelector(".scale-x-\\(--level\\)")
        ).not.toBeNull();
        expect(container.querySelector(".bg-warning")).not.toBeNull();
        expect(container.innerHTML).not.toMatch(/style="[^"]*width:/);
    });

    it("limits the rows to eight and renders nothing without rows", () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `r${index}`,
            label: `Row ${index}`,
            value: 1,
            required: 2,
        }));
        setMotionTier("reduced");
        const { container, rerender } = render(
            <ScrollMeters rows={many} gapLabel={gapLabel} />
        );
        expect(container.querySelectorAll("li")).toHaveLength(8);
        rerender(<ScrollMeters rows={[]} gapLabel={gapLabel} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("has no axe violations", async () => {
        const { container } = renderMeters();
        await expectAccessible(container);
    });
});
