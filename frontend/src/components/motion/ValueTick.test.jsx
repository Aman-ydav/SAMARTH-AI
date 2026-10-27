import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ValueTick } from "@/components/motion/ValueTick";
import { setMotionTier } from "@/test/motionTier";
import { renderWithProviders } from "@/test/renderWithProviders";

describe("ValueTick", () => {
    beforeEach(() => setMotionTier("full"));

    it("keeps the final value for screen readers and starts at the initial value", () => {
        const { container } = renderWithProviders(
            <ValueTick value={75} initial={0} suffix="%" />
        );
        expect(
            container.querySelector("[aria-hidden='true']")
        ).toHaveTextContent("0%");
        expect(container.querySelector(".sr-only")).toHaveTextContent("75%");
    });

    it("shows the final value at once under reduced motion", () => {
        setMotionTier("reduced");
        const { container } = renderWithProviders(
            <ValueTick value={1234} initial={0} />
        );
        expect(
            container.querySelector("[aria-hidden='true']")
        ).toHaveTextContent("1,234");
        expect(container.querySelector(".sr-only")).toHaveTextContent("1,234");
    });

    it("renders the new value for assistive technology when the value changes", async () => {
        const { container, rerender } = renderWithProviders(
            <ValueTick value={2} />
        );
        await act(async () => {
            rerender(<ValueTick value={3} />);
        });
        expect(container.querySelector(".sr-only")).toHaveTextContent("3");
    });

    it("renders mono tabular figures without a provider", () => {
        setMotionTier("reduced");
        render(<ValueTick value={5} className="extra" />);
        expect(
            screen.getAllByText("5")[0].closest("span.font-mono")
        ).toHaveClass("tabular-nums", "extra");
    });
});
