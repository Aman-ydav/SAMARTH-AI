import { lazy } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LazySection } from "@/features/marketing/components/LazySection";
import { stubIntersectionVisible } from "@/test/motionTier";

const Loaded = lazy(() =>
    Promise.resolve({ default: () => <p>Section loaded</p> })
);

describe("LazySection", () => {
    beforeEach(() => {
        window.IntersectionObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return [];
            }
        };
    });

    it("keeps the anchor and reserved height but does not mount far from the viewport", () => {
        const { container } = render(
            <LazySection id="how" component={Loaded} reserve="min-h-svh" />
        );
        expect(container.firstElementChild).toHaveAttribute("id", "how");
        expect(container.firstElementChild).toHaveAttribute(
            "aria-busy",
            "true"
        );
        expect(screen.queryByText("Section loaded")).toBeNull();
        expect(container.querySelector(".min-h-svh")).not.toBeNull();
    });

    it("mounts the lazy section once it is near the viewport", async () => {
        stubIntersectionVisible();
        const { container } = render(
            <LazySection id="faq" component={Loaded} reserve="min-h-svh" />
        );
        expect(await screen.findByText("Section loaded")).toBeInTheDocument();
        expect(container.firstElementChild).toHaveAttribute(
            "aria-busy",
            "false"
        );
    });
});
