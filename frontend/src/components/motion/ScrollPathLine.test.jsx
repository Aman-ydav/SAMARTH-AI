import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollPathLine } from "@/components/motion/ScrollPathLine";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const ITEMS = [
    { id: "one", title: "First stop" },
    { id: "two", title: "Second stop" },
    { id: "three", title: "Third stop" },
];

const renderItem = (item) => <h3>{item.title}</h3>;

describe("ScrollPathLine", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every stop in the DOM, in order, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <ScrollPathLine
                    items={ITEMS}
                    renderItem={renderItem}
                    label="Story"
                />
            );
            const list = screen.getByRole("list", { name: "Story" });
            expect(list.tagName).toBe("OL");
            expect(
                screen
                    .getAllByRole("heading", { level: 3 })
                    .map((heading) => heading.textContent)
            ).toEqual(ITEMS.map((item) => item.title));
        }
    );

    it("draws the line on the full tier with a scaled track and one marker per stop", () => {
        const { container } = render(
            <ScrollPathLine items={ITEMS} renderItem={renderItem} />
        );
        const track = container.querySelector(".origin-top");
        expect(track).not.toBeNull();
        expect(track.getAttribute("style")).toMatch(/scale|transform/);
        expect(
            container.querySelectorAll("li > [aria-hidden='true']")
        ).toHaveLength(ITEMS.length);
    });

    it.each(["lite", "reduced"])(
        "shows the finished line with every stop lit on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = render(
                <ScrollPathLine items={ITEMS} renderItem={renderItem} />
            );
            const track = container.querySelector(".origin-top");
            expect(track).not.toBeNull();
            expect(track.getAttribute("style")).toBeNull();
            for (const heading of screen.getAllByRole("heading")) {
                expect(heading.parentElement.getAttribute("style")).toBeNull();
            }
        }
    );

    it("never animates anything but transform and opacity", () => {
        const { container } = render(
            <ScrollPathLine items={ITEMS} renderItem={renderItem} />
        );
        const styles = [...container.querySelectorAll("[style]")]
            .map((node) => node.getAttribute("style"))
            .join(";");
        expect(styles).not.toMatch(
            /(^|;|\s)(width|height|top|left|margin|padding|font-size)\s*:/
        );
    });

    it("renders at most eight stops and nothing without items", () => {
        const many = Array.from({ length: 12 }, (_, index) => ({
            id: `s${index}`,
            title: `Stop ${index}`,
        }));
        const { container, rerender } = render(
            <ScrollPathLine items={many} renderItem={renderItem} />
        );
        expect(screen.getAllByRole("listitem")).toHaveLength(8);
        rerender(<ScrollPathLine items={[]} renderItem={renderItem} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each(MOTION_TIER_CASES)("has no axe violations on %s", async (tier) => {
        setMotionTier(tier);
        const { container } = render(
            <ScrollPathLine
                items={ITEMS}
                renderItem={renderItem}
                label="Story"
            />
        );
        await expectAccessible(container);
    });
});
