import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceLaptop } from "@/components/motion/DeviceLaptop";
import { LAPTOP } from "@/lib/motionTokens";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

function renderLaptop(props) {
    return render(
        <DeviceLaptop {...props}>
            <p>screen content</p>
        </DeviceLaptop>
    );
}

describe("DeviceLaptop", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps the screen content in the DOM on the %s tier",
        (tier) => {
            setMotionTier(tier);
            renderLaptop();
            expect(screen.getByText("screen content")).toBeInTheDocument();
        }
    );

    it("draws a generic laptop: lid, bezel, camera dot, hinge and base, no logo, text or image", () => {
        const { container } = renderLaptop();
        const frame = container.querySelector("[data-slot='device-laptop']");
        expect(frame.outerHTML).not.toMatch(/shadow|gradient|blur/);
        expect(frame.querySelector(".bg-device-lid")).not.toBeNull();
        expect(frame.querySelector(".bg-device-bezel")).not.toBeNull();
        expect(frame.querySelector(".bg-device-base")).not.toBeNull();
        expect(frame.textContent).toBe("screen content");
        expect(container.querySelector("img, svg")).toBeNull();
    });

    it("draws the screen at the fixed design size and scales it by a CSS variable", () => {
        const { container } = renderLaptop();
        const surface = container.querySelector(".origin-top-left");
        expect(surface).toHaveClass("w-280", "h-175", "scale-(--fit-scale)");
        expect([LAPTOP.screenWidth, LAPTOP.screenHeight]).toEqual([1120, 700]);
        expect(container.querySelector(".aspect-16\\/10")).not.toBeNull();
    });

    it("reports the screen as on at once on the reduced and lite tiers", () => {
        for (const tier of ["reduced", "lite"]) {
            setMotionTier(tier);
            const onScreenOn = vi.fn();
            const { unmount } = renderLaptop({ onScreenOn });
            expect(onScreenOn).toHaveBeenCalled();
            unmount();
        }
    });

    it("plays the lid animation on the full tier only", () => {
        const full = renderLaptop();
        expect(
            full.container.querySelector("[data-state='animated']")
        ).not.toBeNull();
        full.unmount();
        setMotionTier("reduced");
        const reduced = renderLaptop();
        expect(
            reduced.container.querySelector("[data-state='animated']")
        ).toBeNull();
    });
});
