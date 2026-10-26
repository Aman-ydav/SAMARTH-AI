import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TextReveal } from "@/components/motion/TextReveal";
import { expectAccessible } from "@/test/axeCheck";
import { MOTION_TIER_CASES, setMotionTier } from "@/test/motionTier";

const ENGLISH = "Build the skills that official statistics runs on.";
const HINDI = "वे कौशल बनाएँ, जिन पर आधिकारिक सांख्यिकी टिकी है।";

describe("TextReveal", () => {
    beforeEach(() => setMotionTier("full"));

    it.each(MOTION_TIER_CASES)(
        "keeps the full text readable on the %s tier",
        (tier) => {
            setMotionTier(tier);
            render(<TextReveal as="h1" mode="load" text={ENGLISH} />);
            expect(
                screen.getByRole("heading", { level: 1, name: ENGLISH })
            ).toBeInTheDocument();
        }
    );

    it("renders plain text without animation markup under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = render(<TextReveal text={ENGLISH} />);
        expect(container.querySelector("[aria-hidden]")).toBeNull();
        expect(container.querySelector(".sr-only")).toBeNull();
        expect(container).toHaveTextContent(ENGLISH);
    });

    it("renders plain text on the lite tier", () => {
        setMotionTier("lite");
        const { container } = render(
            <TextReveal mode="scroll" text={ENGLISH} />
        );
        expect(container.querySelector("[aria-hidden]")).toBeNull();
    });

    it("splits by words and never by characters (load mode)", () => {
        const { container } = render(
            <TextReveal as="h1" mode="load" text={ENGLISH} />
        );
        const animated = container.querySelector("[aria-hidden='true']");
        const words = ENGLISH.split(" ");
        expect(animated.querySelectorAll(".overflow-clip")).toHaveLength(
            words.length
        );
        expect(animated).toHaveTextContent(ENGLISH);
    });

    it("starts as a masked slide, never from opacity 0 (load mode)", () => {
        const { container } = render(
            <TextReveal as="h1" mode="load" text={ENGLISH} />
        );
        const moving = container.querySelector(
            "[aria-hidden='true'] .inline-block"
        );
        expect(moving.getAttribute("style") ?? "").not.toContain("opacity: 0");
    });

    it("splits Devanagari text by words too (scroll mode)", () => {
        const { container } = render(<TextReveal text={HINDI} />);
        const animated = container.querySelector("[aria-hidden='true']");
        expect(animated.querySelectorAll("span")).toHaveLength(
            HINDI.split(" ").length
        );
        expect(container.querySelector(".sr-only")).toHaveTextContent(HINDI);
    });

    it("renders nothing visible for empty text without throwing", () => {
        const { container } = render(<TextReveal text="" />);
        expect(container.firstElementChild).toBeEmptyDOMElement();
    });

    it("has no axe violations as a heading", async () => {
        const { container } = render(
            <TextReveal as="h1" mode="load" text={ENGLISH} />
        );
        await expectAccessible(container);
    });
});
