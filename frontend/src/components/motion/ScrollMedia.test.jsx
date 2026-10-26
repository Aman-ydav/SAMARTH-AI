import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollMedia } from "@/components/motion/ScrollMedia";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const frames = (count) =>
    Array.from({ length: count }, (_, index) => ({
        id: `frame-${index}`,
        content: <p>Frame {index + 1}</p>,
    }));

describe("ScrollMedia", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every frame in the DOM, in order, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(<ScrollMedia frames={frames(5)} />);
            const texts = screen
                .getAllByText(/^Frame \d$/)
                .map((n) => n.textContent);
            expect(texts).toEqual([
                "Frame 1",
                "Frame 2",
                "Frame 3",
                "Frame 4",
                "Frame 5",
            ]);
        }
    );

    it("crossfades inside a sticky stage: first frame visible, later frames transparent", () => {
        const { container } = render(<ScrollMedia frames={frames(3)} />);
        expect(container.querySelector(".sticky")).not.toBeNull();
        const layers = [...container.querySelectorAll(".col-start-1")];
        expect(layers).toHaveLength(3);
        expect(layers[0].getAttribute("style")).toContain("opacity: 1");
        expect(layers[2].getAttribute("style")).toContain("opacity: 0");
    });

    it("sizes the track from the frame count", () => {
        const { container } = render(<ScrollMedia frames={frames(4)} />);
        expect(container.firstElementChild.getAttribute("style")).toContain(
            "--frames: 4"
        );
    });

    it("renders at most 8 frames", () => {
        render(<ScrollMedia frames={frames(10)} />);
        expect(screen.getAllByText(/^Frame \d+$/)).toHaveLength(8);
    });

    it("stacks frames without a stage under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(<ScrollMedia frames={frames(2)} />);
        expect(container.querySelector(".sticky")).toBeNull();
    });

    it("handles a single frame and no frames", () => {
        const { container, rerender } = render(
            <ScrollMedia frames={frames(1)} />
        );
        expect(screen.getByText("Frame 1")).toBeInTheDocument();
        rerender(<ScrollMedia frames={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
