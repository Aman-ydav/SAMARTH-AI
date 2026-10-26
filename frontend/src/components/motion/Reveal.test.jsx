import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Reveal } from "@/components/motion/Reveal";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

describe("Reveal", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)("renders its content on the %s tier", (tier) => {
        setMotionTier(tier);
        render(
            <Reveal>
                <p>Visible content</p>
            </Reveal>
        );
        expect(screen.getByText("Visible content")).toBeInTheDocument();
    });

    it("renders the requested element and class on every tier", () => {
        for (const tier of MOTION_TIER_CASES) {
            setMotionTier(tier);
            const { container, unmount } = render(
                <Reveal as="section" className="rise" id="block">
                    Text
                </Reveal>
            );
            const node = container.firstElementChild;
            expect(node.tagName).toBe("SECTION");
            expect(node).toHaveClass("rise");
            expect(node).toHaveAttribute("id", "block");
            unmount();
        }
    });

    it("is static under reduced motion (no inline motion style)", () => {
        setMotionTier("reduced");
        const { container } = render(<Reveal>Static</Reveal>);
        expect(container.firstElementChild).not.toHaveAttribute("style");
    });

    it("starts hidden and offset on the full tier", () => {
        const { container } = render(<Reveal>Animated</Reveal>);
        const style = container.firstElementChild.getAttribute("style");
        expect(style).toContain("opacity: 0");
    });
});
