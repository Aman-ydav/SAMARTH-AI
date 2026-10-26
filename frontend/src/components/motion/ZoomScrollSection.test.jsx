import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ZoomScrollSection } from "@/components/motion/ZoomScrollSection";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

describe("ZoomScrollSection", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)("renders its content on the %s tier", (tier) => {
        setMotionTier(tier);
        render(
            <ZoomScrollSection>
                <p>Product mock</p>
            </ZoomScrollSection>
        );
        expect(screen.getByText("Product mock")).toBeInTheDocument();
    });

    it("pins a sticky svh stage inside a 250svh track on the full tier", () => {
        const { container } = render(
            <ZoomScrollSection>
                <p>Mock</p>
            </ZoomScrollSection>
        );
        expect(container.firstElementChild).toHaveClass("h-[250svh]");
        const stage = container.querySelector(".sticky");
        expect(stage).toHaveClass("top-0", "h-svh", "overflow-clip");
    });

    it("never starts below 0.6 scale", () => {
        const { container } = render(
            <ZoomScrollSection startScale={0.1}>
                <p>Mock</p>
            </ZoomScrollSection>
        );
        const style = container
            .querySelector(".will-change-transform")
            .getAttribute("style");
        expect(style).toContain("scale(0.6)");
    });

    it("is a plain natural-size block under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(
            <ZoomScrollSection className="mock-wrapper">
                <p>Mock</p>
            </ZoomScrollSection>
        );
        expect(container.querySelector(".sticky")).toBeNull();
        expect(container.firstElementChild).toHaveClass("mock-wrapper");
    });

    it("omits the tilt wrapper when tilt is off", () => {
        const { container } = render(
            <ZoomScrollSection tilt={false}>
                <p>Mock</p>
            </ZoomScrollSection>
        );
        expect(container.querySelector(".origin-bottom")).toBeNull();
    });
});
