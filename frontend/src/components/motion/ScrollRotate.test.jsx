import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollRotate } from "@/components/motion/ScrollRotate";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const items = (count) =>
    Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index + 1}`,
    }));
const renderItem = (item) => <span>{item.label}</span>;

describe("ScrollRotate", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "renders every item and the centre content on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <ScrollRotate items={items(4)} renderItem={renderItem}>
                    <p>Centre</p>
                </ScrollRotate>
            );
            expect(screen.getByText("Centre")).toBeInTheDocument();
            for (let n = 1; n <= 4; n += 1) {
                expect(screen.getByText(`Item ${n}`)).toBeInTheDocument();
            }
        }
    );

    it("places items on a ring with CSS variables and keeps them upright", () => {
        const { container } = render(
            <ScrollRotate items={items(4)} renderItem={renderItem} />
        );
        const ring = container.querySelector("ul");
        expect(ring.getAttribute("style")).toContain("transform");
        const first = ring.querySelector("li");
        expect(first.getAttribute("style")).toContain("--x");
        expect(first.firstElementChild.getAttribute("style")).toContain(
            "transform"
        );
    });

    it("limits the ring to 12 items", () => {
        render(<ScrollRotate items={items(15)} renderItem={renderItem} />);
        expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(12);
    });

    it("shows a plain grid with no rotation under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(
            <ScrollRotate items={items(3)} renderItem={renderItem} />
        );
        expect(container.querySelector("[style]")).toBeNull();
        expect(container.querySelector(".grid")).not.toBeNull();
    });

    it("renders nothing without items", () => {
        const { container } = render(
            <ScrollRotate items={[]} renderItem={renderItem} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
