import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SpiralCards3D } from "@/components/motion/SpiralCards3D";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const LETTERS = ["S", "A", "M", "A", "R", "T", "H"];
const items = LETTERS.map((letter, index) => ({ id: `card-${index}`, letter }));
const renderItem = (item) => <article>Card {item.letter}</article>;

describe("SpiralCards3D", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "renders all seven cards in S-A-M-A-R-T-H order on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(<SpiralCards3D items={items} renderItem={renderItem} />);
            const cards = screen.getAllByText(/^Card [A-Z]$/);
            expect(
                cards.map((card) => card.textContent.slice(-1)).join("")
            ).toBe("SAMARTH");
        }
    );

    it("pins a sticky 3D stage and spaces the cards around the spiral on the full tier", () => {
        const { container } = render(
            <SpiralCards3D items={items} renderItem={renderItem} />
        );
        expect(container.querySelector(".sticky")).toHaveClass(
            "perspective-distant"
        );
        const cards = container.querySelectorAll("ol > li");
        expect(cards).toHaveLength(7);
        expect(cards[1].getAttribute("style")).toContain("rotateY(");
        expect(cards[0].firstElementChild).toHaveClass("backface-hidden");
    });

    it("falls back to a one-column list under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(
            <SpiralCards3D items={items} renderItem={renderItem} />
        );
        expect(container.querySelector(".sticky")).toBeNull();
        expect(container.querySelector("ol")).toHaveClass("flex-col");
    });

    it("renders at most 8 cards", () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `many-${index}`,
            letter: "X",
        }));
        render(<SpiralCards3D items={many} renderItem={renderItem} />);
        expect(screen.getAllByText("Card X")).toHaveLength(8);
    });

    it("renders nothing without items", () => {
        const { container } = render(
            <SpiralCards3D items={[]} renderItem={renderItem} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
