import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";
import { setMotionTier } from "@/test/motionTier";

describe("ScrollProgressBar", () => {
    beforeEach(() => setMotionTier("full"));

    it("renders an aria-hidden 2px bar on the full tier", () => {
        const { container } = render(<ScrollProgressBar />);
        const bar = container.firstElementChild;
        expect(bar).toHaveAttribute("aria-hidden", "true");
        expect(bar).toHaveClass("h-0.5", "bg-primary", "fixed");
    });

    it("renders on the lite tier", () => {
        setMotionTier("lite");
        const { container } = render(<ScrollProgressBar />);
        expect(container.firstElementChild).not.toBeNull();
    });

    it("renders nothing under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(<ScrollProgressBar />);
        expect(container).toBeEmptyDOMElement();
    });
});
