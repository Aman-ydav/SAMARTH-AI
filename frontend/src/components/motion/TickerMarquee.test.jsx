import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TickerMarquee } from "@/components/motion/TickerMarquee";
import { expectAccessible } from "@/test/axeCheck";
import {
    MOTION_TIER_CASES,
    setMotionTier,
    stubIntersectionVisible,
} from "@/test/motionTier";

const ITEMS = ["Sampling", "SDMX", "Python"];

describe("TickerMarquee", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)("shows every chip on the %s tier", (tier) => {
        setMotionTier(tier);
        render(<TickerMarquee items={ITEMS} ariaLabel="Skills" />);
        for (const item of ITEMS) {
            expect(screen.getAllByText(item).length).toBeGreaterThan(0);
        }
    });

    it("is a single static wrapped list under reduced motion", () => {
        setMotionTier("reduced");
        render(<TickerMarquee items={ITEMS} ariaLabel="Skills" />);
        const list = screen.getByRole("list", { name: "Skills" });
        expect(list).toHaveClass("flex-wrap");
        expect(within(list).getAllByRole("listitem")).toHaveLength(
            ITEMS.length
        );
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("still renders both copies when the scroll boost is turned off (auth pages, ANIM-54)", () => {
        render(<TickerMarquee items={ITEMS} ariaLabel="Skills" boost={false} />);
        const group = screen.getByRole("group", { name: "Skills" });
        expect(group.querySelectorAll("ul")).toHaveLength(2);
    });

    it("renders two copies and hides the second from assistive tech", () => {
        render(<TickerMarquee items={ITEMS} ariaLabel="Skills" />);
        const group = screen.getByRole("group", { name: "Skills" });
        const lists = group.querySelectorAll("ul");
        expect(lists).toHaveLength(2);
        expect(lists[0]).not.toHaveAttribute("aria-hidden");
        expect(lists[1]).toHaveAttribute("aria-hidden", "true");
        expect(screen.getAllByText("SDMX")).toHaveLength(2);
    });

    it("offers a visible pause button that toggles", () => {
        render(
            <TickerMarquee
                items={ITEMS}
                ariaLabel="Skills"
                pauseLabel="Pause chips"
                playLabel="Resume chips"
            />
        );
        const pause = screen.getByRole("button", { name: "Pause chips" });
        expect(pause).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(pause);
        const resume = screen.getByRole("button", { name: "Resume chips" });
        expect(resume).toHaveAttribute("aria-pressed", "true");
    });

    it("has no pause button unless labels are given", () => {
        render(<TickerMarquee items={ITEMS} ariaLabel="Skills" />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("runs while in view and survives hover and focus pauses", () => {
        stubIntersectionVisible();
        render(
            <TickerMarquee
                items={ITEMS}
                ariaLabel="Skills"
                pauseLabel="Pause chips"
                playLabel="Resume chips"
            />
        );
        const group = screen.getByRole("group", { name: "Skills" });
        const region = group.firstElementChild;
        fireEvent.mouseEnter(region);
        fireEvent.mouseLeave(region);
        fireEvent.focus(region);
        fireEvent.blur(region);
        expect(screen.getAllByText("Python")).toHaveLength(2);
    });

    it("renders nothing without items", () => {
        const { container } = render(
            <TickerMarquee items={[]} ariaLabel="x" />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("has no axe violations", async () => {
        const { container } = render(
            <TickerMarquee
                items={ITEMS}
                ariaLabel="Skills"
                pauseLabel="Pause chips"
                playLabel="Resume chips"
            />
        );
        await expectAccessible(container);
    });
});
