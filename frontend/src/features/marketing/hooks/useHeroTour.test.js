import { createElement as h } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHeroTour } from "@/features/marketing/hooks/useHeroTour";
import { stubIntersectionVisible } from "@/test/motionTier";

function Harness({ autoplay = true, count = 4, stepMs = 1000, initial = 0 }) {
    const [ref, tour] = useHeroTour({ count, autoplay, stepMs, initial });
    return h(
        "div",
        {
            ref,
            "data-testid": "stage",
            onPointerEnter: tour.hold,
            onPointerLeave: tour.release,
        },
        h("span", { "data-testid": "step" }, tour.step),
        h("span", { "data-testid": "running" }, String(tour.running)),
        h("button", { type: "button", onClick: tour.togglePlaying }, "toggle"),
        h("button", { type: "button", onClick: () => tour.goTo(2) }, "go")
    );
}

async function mount(props) {
    const result = render(h(Harness, props));
    await act(async () => {});
    return result;
}

const step = () => Number(screen.getByTestId("step").textContent);
const tick = (ms) =>
    act(() => {
        vi.advanceTimersByTime(ms);
    });

describe("useHeroTour", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        stubIntersectionVisible();
    });
    afterEach(() => vi.useRealTimers());

    it("advances one step per interval and loops back to the first", async () => {
        await mount();
        expect(step()).toBe(0);
        tick(1000);
        expect(step()).toBe(1);
        tick(1000);
        tick(1000);
        tick(1000);
        expect(step()).toBe(0);
    });

    it("does not run when autoplay is off and starts at the initial step", async () => {
        await mount({ autoplay: false, initial: 3 });
        tick(5000);
        expect(step()).toBe(3);
        expect(screen.getByTestId("running")).toHaveTextContent("false");
    });

    it("pauses and resumes from the play button", async () => {
        await mount();
        fireEvent.click(screen.getByText("toggle"));
        tick(5000);
        expect(step()).toBe(0);
        fireEvent.click(screen.getByText("toggle"));
        tick(1000);
        expect(step()).toBe(1);
    });

    it("holds while the pointer is inside", async () => {
        await mount();
        fireEvent.pointerEnter(screen.getByTestId("stage"));
        tick(5000);
        expect(step()).toBe(0);
        fireEvent.pointerLeave(screen.getByTestId("stage"));
        tick(1000);
        expect(step()).toBe(1);
    });

    it("lets a manual step restart the timer", async () => {
        await mount();
        tick(900);
        fireEvent.click(screen.getByText("go"));
        expect(step()).toBe(2);
        tick(900);
        expect(step()).toBe(2);
        tick(100);
        expect(step()).toBe(3);
    });

    it("does not run while the stage is out of view", async () => {
        window.IntersectionObserver = class {
            constructor(callback) {
                this.callback = callback;
            }
            observe(target) {
                queueMicrotask(() =>
                    this.callback(
                        [
                            {
                                isIntersecting: false,
                                intersectionRatio: 0,
                                target,
                            },
                        ],
                        this
                    )
                );
            }
            unobserve() {}
            disconnect() {}
        };
        await mount();
        tick(5000);
        expect(step()).toBe(0);
    });
});
