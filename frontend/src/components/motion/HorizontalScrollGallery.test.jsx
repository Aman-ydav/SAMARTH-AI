import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HorizontalScrollGallery } from "@/components/motion/HorizontalScrollGallery";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const items = ["Learner", "Trainer", "Admin"].map((name) => ({
    id: name.toLowerCase(),
    name,
}));
const renderItem = (item) => <button type="button">{item.name} card</button>;

function renderGallery() {
    return render(
        <HorizontalScrollGallery
            items={items}
            renderItem={renderItem}
            label="User roles"
            header={<h2>Built for four kinds of users</h2>}
        />
    );
}

describe("HorizontalScrollGallery", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "renders the header and every card on the %s tier",
        (tier) => {
            setMotionTier(tier);
            renderGallery();
            expect(
                screen.getByRole("heading", {
                    name: "Built for four kinds of users",
                })
            ).toBeInTheDocument();
            for (const item of items) {
                expect(
                    screen.getByRole("button", { name: `${item.name} card` })
                ).toBeInTheDocument();
            }
        }
    );

    it("is a native, keyboard-scrollable snap strip under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = renderGallery();
        const strip = screen.getByRole("region", { name: "User roles" });
        expect(strip).toHaveAttribute("tabindex", "0");
        expect(strip).toHaveClass("overflow-x-auto");
        expect(container.querySelector(".sticky")).toBeNull();
        expect(container.querySelector(".snap-x")).not.toBeNull();
        expect(container.innerHTML).not.toContain("snap-mandatory");
    });

    it("pins a sticky stage with a labelled list on the full tier", () => {
        const { container } = renderGallery();
        expect(container.querySelector(".sticky")).not.toBeNull();
        expect(
            screen.getByRole("list", { name: "User roles" })
        ).toBeInTheDocument();
        expect(container.firstElementChild.getAttribute("style")).toContain(
            "--gallery-travel"
        );
    });

    it("scrolls the page when a card receives keyboard focus", () => {
        renderGallery();
        window.scrollTo.mockClear();
        fireEvent.focus(screen.getByRole("button", { name: "Admin card" }));
        expect(window.scrollTo).toHaveBeenCalledTimes(1);
    });

    it("renders nothing without items", () => {
        const { container } = render(
            <HorizontalScrollGallery items={[]} renderItem={renderItem} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("has no axe violations in the native and pinned forms", async () => {
        const { container, unmount } = renderGallery();
        await expectAccessible(container);
        unmount();
        setMotionTier("reduced");
        const native = renderGallery();
        await expectAccessible(native.container);
    });
});
