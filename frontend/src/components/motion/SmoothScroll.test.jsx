import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

vi.mock("lenis", () => ({
    default: class FakeLenis {
        destroy() {}
        scrollTo() {}
    },
}));

describe("SmoothScroll", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "renders its children on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <MemoryRouter>
                    <SmoothScroll>
                        <main>
                            <p>Marketing content</p>
                        </main>
                    </SmoothScroll>
                </MemoryRouter>
            );
            expect(screen.getByText("Marketing content")).toBeInTheDocument();
        }
    );
});
