import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";

const part = (container, slot) =>
    container.querySelector(`[data-slot='${slot}']`);

describe("MockLevelBar", () => {
    it("sets the current and required levels as CSS variables on the 0 to 5 scale", () => {
        const { container } = render(<MockLevelBar level={2} required={4} />);
        const bar = part(container, "mock-level-bar");
        expect(bar.style.getPropertyValue("--level")).toBe("0.4");
        expect(bar.style.getPropertyValue("--required")).toBe("0.8");
        expect(bar.style.getPropertyValue("--required-at")).toBe("80%");
    });

    it("draws the fills with scale and the required layer in the warning token, never with a width", () => {
        const { container } = render(<MockLevelBar level={2} required={4} />);
        expect(part(container, "mock-level-current")).toHaveClass(
            "scale-x-(--level)",
            "bg-primary",
            "origin-left"
        );
        expect(part(container, "mock-level-required")).toHaveClass(
            "scale-x-(--required)",
            "bg-warning"
        );
        expect(container.innerHTML).not.toMatch(/width:/);
    });

    it("hides the required layer and its tick with opacity until asked to show them", () => {
        const { container, rerender } = render(
            <MockLevelBar level={2} required={4} showRequired={false} />
        );
        expect(part(container, "mock-level-required")).toHaveClass("opacity-0");
        expect(part(container, "mock-level-tick")).toHaveClass("opacity-0");
        rerender(<MockLevelBar level={2} required={4} showRequired />);
        expect(part(container, "mock-level-required")).toHaveClass(
            "opacity-100"
        );
        expect(part(container, "mock-level-tick")).toHaveClass("opacity-100");
    });

    it("can show the 0 to 5 tick marks", () => {
        const { container } = render(
            <MockLevelBar level={1} required={3} ticks />
        );
        expect(
            container.querySelectorAll("[aria-hidden='true'] span")
        ).toHaveLength(6);
    });

    it("accepts a zero level (the screen before it is on)", () => {
        const { container } = render(<MockLevelBar level={0} required={3} />);
        expect(
            part(container, "mock-level-bar").style.getPropertyValue("--level")
        ).toBe("0");
    });
});
