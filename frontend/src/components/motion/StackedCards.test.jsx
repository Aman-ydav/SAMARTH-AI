import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { StackedCards } from "@/components/motion/StackedCards";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const ITEMS = [
    { id: "one", title: "Chapter one", body: "Body one." },
    { id: "two", title: "Chapter two", body: "Body two." },
    { id: "three", title: "Chapter three", body: "Body three." },
];

const renderItem = (item) => (
    <article>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
    </article>
);

describe("StackedCards", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps every card in the DOM, in order, on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(
                <StackedCards
                    items={ITEMS}
                    renderItem={renderItem}
                    label="Chapters"
                />
            );
            expect(
                screen.getByRole("list", { name: "Chapters" })
            ).toBeInTheDocument();
            expect(
                screen
                    .getAllByRole("heading", { level: 3 })
                    .map((heading) => heading.textContent)
            ).toEqual(ITEMS.map((item) => item.title));
            for (const item of ITEMS)
                expect(screen.getByText(item.body)).toBeInTheDocument();
        }
    );

    it("pins every card with its own offset variable on the full tier", () => {
        const { container } = render(
            <StackedCards items={ITEMS} renderItem={renderItem} />
        );
        const cards = [...container.querySelectorAll("li")];
        expect(cards).toHaveLength(ITEMS.length);
        cards.forEach((card, index) => {
            expect(card).toHaveClass("sticky");
            expect(card.style.getPropertyValue("--stack-top")).toBe(
                `${5 + index}rem`
            );
        });
        expect(container.querySelectorAll("li > .origin-top")).toHaveLength(
            ITEMS.length
        );
    });

    it.each(["lite", "reduced"])(
        "is a plain list without sticky cards or transforms on the %s tier",
        (tier) => {
            setMotionTier(tier);
            const { container } = render(
                <StackedCards items={ITEMS} renderItem={renderItem} />
            );
            expect(container.querySelector(".sticky")).toBeNull();
            expect(container.querySelector("[style]")).toBeNull();
        }
    );

    it("animates only a scale, never a layout property", () => {
        const { container } = render(
            <StackedCards items={ITEMS} renderItem={renderItem} />
        );
        const moving = container.querySelector("li > .origin-top");
        expect(moving.getAttribute("style")).toMatch(/scale|transform/);
        expect(moving.getAttribute("style")).not.toMatch(
            /(^|;|\s)(width|height|top|left|margin|padding)\s*:/
        );
    });

    it("renders at most six cards and nothing without items", () => {
        const many = Array.from({ length: 9 }, (_, index) => ({
            id: `c${index}`,
            title: `Card ${index}`,
            body: "text",
        }));
        const { container, rerender } = render(
            <StackedCards items={many} renderItem={renderItem} />
        );
        expect(screen.getAllByRole("listitem")).toHaveLength(6);
        rerender(<StackedCards items={[]} renderItem={renderItem} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each(MOTION_TIER_CASES)("has no axe violations on %s", async (tier) => {
        setMotionTier(tier);
        const { container } = render(
            <StackedCards
                items={ITEMS}
                renderItem={renderItem}
                label="Chapters"
            />
        );
        await expectAccessible(container);
    });
});
