import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockHighlight } from "@/features/marketing/components/MockHighlight";

describe("MockHighlight", () => {
    it("draws a token border over the card and fades it with opacity only", () => {
        const { container } = render(
            <MockHighlight on>
                <p>card</p>
            </MockHighlight>
        );
        const border = container.querySelector("[aria-hidden='true']");
        expect(screen.getByText("card")).toBeInTheDocument();
        expect(border).toHaveClass(
            "border-primary",
            "opacity-100",
            "transition-opacity"
        );
        expect(border.className).not.toMatch(/ring|shadow|transition-all/);
        expect(container.firstChild).toHaveAttribute(
            "data-highlighted",
            "true"
        );
    });

    it("hides the border when off", () => {
        const { container } = render(
            <MockHighlight on={false}>
                <p>card</p>
            </MockHighlight>
        );
        expect(container.querySelector("[aria-hidden='true']")).toHaveClass(
            "opacity-0"
        );
        expect(container.firstChild).toHaveAttribute(
            "data-highlighted",
            "false"
        );
    });
});
