import { render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollTilt3D } from "@/components/motion/ScrollTilt3D";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

describe("ScrollTilt3D", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)("renders its content on the %s tier", (tier) => {
        setMotionTier(tier);
        render(
            <ScrollTilt3D progress={motionValue(0)}>
                <p>Screen</p>
            </ScrollTilt3D>
        );
        expect(screen.getByText("Screen")).toBeInTheDocument();
    });

    it("tilts with rotateX and a perspective at the start of the track", () => {
        const { container } = render(
            <ScrollTilt3D progress={motionValue(0)} tilt={30}>
                <p>Screen</p>
            </ScrollTilt3D>
        );
        const style = container.firstElementChild.getAttribute("style");
        expect(style).toContain("rotateX(30deg)");
        expect(style).toContain("perspective(");
    });

    it("is flat once the progress is complete", () => {
        const { container } = render(
            <ScrollTilt3D progress={motionValue(1)}>
                <p>Screen</p>
            </ScrollTilt3D>
        );
        expect(container.firstElementChild.getAttribute("style")).not.toContain(
            "rotateX("
        );
    });

    it("caps the tilt at 35 degrees", () => {
        const { container } = render(
            <ScrollTilt3D progress={motionValue(0)} tilt={80}>
                <p>Screen</p>
            </ScrollTilt3D>
        );
        expect(container.firstElementChild.getAttribute("style")).toContain(
            "rotateX(35deg)"
        );
    });

    it("renders flat without a progress value or under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(
            <ScrollTilt3D progress={motionValue(0)}>
                <p>Screen</p>
            </ScrollTilt3D>
        );
        expect(container.firstElementChild).not.toHaveAttribute("style");
    });
});
