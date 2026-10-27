import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFitScale } from "@/hooks/useFitScale";

function Harness() {
    const ref = useFitScale(1000);
    return createElement("div", { ref, "data-testid": "frame" });
}

function stubWidth(width) {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        width
    );
}

describe("useFitScale", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("sets --fit-scale to the element width over the design width and observes resizes", () => {
        const disconnect = vi.fn();
        const observe = vi.fn();
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe = observe;
                disconnect = disconnect;
            }
        );
        stubWidth(500);
        const { unmount } = render(createElement(Harness));
        expect(
            screen.getByTestId("frame").style.getPropertyValue("--fit-scale")
        ).toBe("0.5");
        expect(observe).toHaveBeenCalledTimes(1);
        unmount();
        expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it("works without ResizeObserver", () => {
        vi.stubGlobal("ResizeObserver", undefined);
        stubWidth(250);
        render(createElement(Harness));
        expect(
            screen.getByTestId("frame").style.getPropertyValue("--fit-scale")
        ).toBe("0.25");
    });

    it("leaves the variable unset while the element has no width", () => {
        vi.stubGlobal("ResizeObserver", undefined);
        stubWidth(0);
        render(createElement(Harness));
        expect(
            screen.getByTestId("frame").style.getPropertyValue("--fit-scale")
        ).toBe("");
    });
});
