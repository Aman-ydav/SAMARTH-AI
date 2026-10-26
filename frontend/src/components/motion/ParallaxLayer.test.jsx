import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

describe("ParallaxLayer", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)("renders its layer on the %s tier", (tier) => {
        setMotionTier(tier);
        render(
            <ParallaxLayer>
                <svg data-testid="art" />
            </ParallaxLayer>
        );
        expect(screen.getByTestId("art")).toBeInTheDocument();
    });

    it("is decorative and clipped on every tier", () => {
        for (const tier of MOTION_TIER_CASES) {
            setMotionTier(tier);
            const { container, unmount } = render(
                <ParallaxLayer className="custom">
                    <svg />
                </ParallaxLayer>
            );
            expect(container.firstElementChild).toHaveAttribute(
                "aria-hidden",
                "true"
            );
            expect(container.firstElementChild).toHaveClass(
                "overflow-clip",
                "custom"
            );
            unmount();
        }
    });

    it("moves only on Y on the full tier", () => {
        const { container } = render(
            <ParallaxLayer distance={200}>
                <svg />
            </ParallaxLayer>
        );
        const style =
            container.firstElementChild.firstElementChild.getAttribute("style");
        expect(style).toContain("translateY(");
        expect(style).not.toContain("translateX(");
    });

    it("renders a static wrapper under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(
            <ParallaxLayer>
                <svg />
            </ParallaxLayer>
        );
        expect(container.querySelector("[style]")).toBeNull();
    });
});
