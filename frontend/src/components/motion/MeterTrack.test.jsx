import { render } from "@testing-library/react";
import { motion, motionValue } from "motion/react";
import { describe, expect, it } from "vitest";
import { MeterTrack } from "@/components/motion/MeterTrack";

describe("MeterTrack", () => {
    it("draws the required level in the warning token under the current level, with a tick", () => {
        const { container } = render(<MeterTrack required={4} max={5} />);
        expect(container.querySelector(".bg-warning")).toHaveClass(
            "scale-x-(--required)",
            "origin-left"
        );
        expect(container.querySelector(".bg-primary")).toHaveClass(
            "scale-x-(--level)"
        );
        expect(container.querySelector(".bg-foreground")).toHaveClass(
            "-translate-x-full"
        );
        const track = container.firstChild;
        expect(track.style.getPropertyValue("--required")).toBe("0.8");
        expect(track.style.getPropertyValue("--required-at")).toBe("80%");
    });

    it("takes the fill and the gap opacity from motion values when driven by scroll", () => {
        const { container } = render(
            <MeterTrack
                Animated={motion.span}
                required={3}
                max={5}
                fill={motionValue(0.5)}
                gapOpacity={motionValue(0)}
            />
        );
        expect(container.querySelector(".bg-primary")).not.toHaveClass(
            "scale-x-(--level)"
        );
        expect(container.querySelector(".bg-warning").style.opacity).toBe("0");
    });
});
