import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ChainReveal } from "@/components/motion/ChainReveal";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const ITEMS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const renderItem = (item, index) => (
    <p>
        Block {index + 1} {item.id}
    </p>
);

describe("ChainReveal", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every block in the DOM, in order, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <ChainReveal
                    items={ITEMS}
                    renderItem={renderItem}
                    label="Chain"
                />
            );
            const blocks = screen.getAllByRole("listitem");
            expect(blocks).toHaveLength(4);
            expect(blocks.map((block) => block.textContent)).toEqual([
                "Block 1 a",
                "Block 2 b",
                "Block 3 c",
                "Block 4 d",
            ]);
            expect(
                screen.getByRole("list", { name: "Chain" })
            ).toBeInTheDocument();
        }
    );

    it("draws one link between every two blocks", () => {
        setMotionTier("reduced");
        const { container } = render(
            <ChainReveal items={ITEMS} renderItem={renderItem} />
        );
        expect(container.querySelectorAll("span.bg-primary")).toHaveLength(3);
    });

    it("uses no pinned stage and caps the chain at six blocks", () => {
        const many = Array.from({ length: 9 }, (_, index) => ({
            id: `${index}`,
        }));
        const { container } = render(
            <ChainReveal items={many} renderItem={renderItem} />
        );
        expect(container.querySelector(".sticky")).toBeNull();
        expect(container.querySelectorAll("li")).toHaveLength(6);
    });

    it("renders nothing without items", () => {
        const { container } = render(
            <ChainReveal items={[]} renderItem={renderItem} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("has no axe violations", async () => {
        const { container } = render(
            <ChainReveal items={ITEMS} renderItem={renderItem} label="Chain" />
        );
        await expectAccessible(container);
    });
});
