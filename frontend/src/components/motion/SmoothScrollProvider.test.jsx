import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";
import { setMotionTier } from "@/test/motionTier";

const instances = vi.hoisted(() => []);

vi.mock("lenis", () => ({
    default: class FakeLenis {
        constructor(options) {
            this.options = options;
            this.destroy = vi.fn();
            this.scrollTo = vi.fn();
            instances.push(this);
        }
    },
}));

function Go() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/next")}>go</button>;
}

function renderProvider(ui = null) {
    return render(
        <MemoryRouter>
            <SmoothScrollProvider>
                <p>page</p>
                {ui}
            </SmoothScrollProvider>
        </MemoryRouter>
    );
}

describe("SmoothScrollProvider", () => {
    beforeEach(() => {
        instances.length = 0;
        setMotionTier("full");
    });

    it("renders its children and starts one Lenis on the full tier", () => {
        renderProvider();
        expect(screen.getByText("page")).toBeInTheDocument();
        expect(instances).toHaveLength(1);
        expect(instances[0].options.autoRaf).toBe(true);
        expect(instances[0].options.respectReducedMotion).toBeUndefined();
    });

    it("never starts Lenis under reduced motion or on the lite tier", () => {
        setMotionTier("reduced");
        renderProvider();
        setMotionTier("lite");
        renderProvider();
        expect(instances).toHaveLength(0);
        expect(screen.getAllByText("page")).toHaveLength(2);
    });

    it("destroys Lenis on unmount", () => {
        const { unmount } = renderProvider();
        unmount();
        expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    });

    it("survives a StrictMode double mount without leaking an instance", () => {
        render(
            <StrictMode>
                <MemoryRouter>
                    <SmoothScrollProvider>
                        <p>page</p>
                    </SmoothScrollProvider>
                </MemoryRouter>
            </StrictMode>
        );
        const alive = instances.filter(
            (lenis) => lenis.destroy.mock.calls.length === 0
        );
        expect(alive).toHaveLength(1);
    });

    it("scrolls to the top on a route change", () => {
        renderProvider(<Go />);
        const lenis = instances[0];
        lenis.scrollTo.mockClear();
        fireEvent.click(screen.getByRole("button", { name: "go" }));
        expect(lenis.scrollTo).toHaveBeenCalledWith(0, {
            immediate: true,
            force: true,
        });
    });
});
