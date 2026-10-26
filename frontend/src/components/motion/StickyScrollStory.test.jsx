import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { StickyScrollStory } from "@/components/motion/StickyScrollStory";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const STEPS = [
    { id: "one", title: "First step", body: "Body of the first step." },
    { id: "two", title: "Second step", body: "Body of the second step." },
    { id: "three", title: "Third step", body: "Body of the third step." },
];

const renderVisual = (step) => <div data-testid="visual">{step.id}</div>;

describe("StickyScrollStory", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every step text in the DOM, in order, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <StickyScrollStory steps={STEPS} renderVisual={renderVisual} />
            );
            const headings = screen
                .getAllByRole("heading", { level: 3 })
                .map((heading) => heading.textContent);
            expect(headings).toEqual(STEPS.map((step) => step.title));
            for (const step of STEPS) {
                expect(screen.getByText(step.body)).toBeInTheDocument();
            }
        }
    );

    it("renders every visual, decorative, on every tier", () => {
        for (const tier of MOTION_TIER_CASES) {
            setMotionTier(tier);
            const { container, unmount } = render(
                <StickyScrollStory steps={STEPS} renderVisual={renderVisual} />
            );
            expect(screen.getAllByTestId("visual")).toHaveLength(STEPS.length);
            expect(
                container.querySelectorAll("[aria-hidden='true']").length
            ).toBeGreaterThan(0);
            unmount();
        }
    });

    it("pins a sticky visual column and shows only the first visual on the full tier", () => {
        const { container } = render(
            <StickyScrollStory steps={STEPS} renderVisual={renderVisual} />
        );
        expect(container.querySelector(".sticky")).not.toBeNull();
        const visuals = [
            ...container.querySelectorAll("[aria-hidden='true'] > div"),
        ];
        expect(visuals[0]).toHaveClass("opacity-100");
        expect(visuals[1]).toHaveClass("opacity-0");
    });

    it("stacks steps with their visuals without a sticky stage on lite and reduced tiers", () => {
        setMotionTier("reduced");
        const { container } = render(
            <StickyScrollStory steps={STEPS} renderVisual={renderVisual} />
        );
        expect(container.querySelector(".sticky")).toBeNull();
    });

    it("renders nothing without steps", () => {
        const { container } = render(
            <StickyScrollStory steps={[]} renderVisual={renderVisual} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("has no axe violations", async () => {
        const { container } = render(
            <StickyScrollStory steps={STEPS} renderVisual={renderVisual} />
        );
        await expectAccessible(container);
    });
});
