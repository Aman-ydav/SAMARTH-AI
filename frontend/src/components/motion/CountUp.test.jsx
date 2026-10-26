import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CountUp } from "@/components/motion/CountUp";
import {
    MOTION_TIER_CASES,
    setMotionTier,
    stubIntersectionVisible,
} from "@/test/motionTier";

describe("CountUp", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "exposes the final value to assistive tech on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = render(<CountUp value={43} />);
            expect(container).toHaveTextContent("43");
        }
    );

    it("shows only the final value under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(<CountUp value={43} />);
        expect(container.querySelector("[aria-hidden]")).toBeNull();
        expect(container.firstElementChild).toHaveClass(
            "font-mono",
            "tabular-nums"
        );
    });

    it("starts at zero with an sr-only final value before it is seen", () => {
        const { container } = render(<CountUp value={43} />);
        expect(
            container.querySelector("[aria-hidden='true']")
        ).toHaveTextContent("0");
        expect(container.querySelector(".sr-only")).toHaveTextContent("43");
    });

    it("counts up to the final value once in view", async () => {
        stubIntersectionVisible();
        const { container } = render(<CountUp value={10} duration={0.05} />);
        await waitFor(() =>
            expect(
                container.querySelector("[aria-hidden='true']")
            ).toHaveTextContent("10")
        );
    });

    it("groups digits with the Indian locale", () => {
        setMotionTier("reduced");
        render(<CountUp value={123456} />);
        expect(screen.getByText("1,23,456")).toBeInTheDocument();
    });
});
