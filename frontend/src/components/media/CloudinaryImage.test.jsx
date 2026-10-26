import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CloudinaryImage,
    buildImageUrl,
} from "@/components/media/CloudinaryImage";
import { logger } from "@/lib/logger";
import { loadAllNamespaces } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";

await loadAllNamespaces();

const envMock = vi.hoisted(() => ({
    cloudinaryCloudName: "demo-cloud",
    isDev: true,
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

const ID = "samarth-ai/prod/marketing/tour-assessment";

describe("buildImageUrl", () => {
    it("applies f_auto,q_auto and an optional width limit", () => {
        const sized = new URL(buildImageUrl("c", "a/b c", 640));
        expect(sized.protocol).toBe("https:");
        expect(sized.pathname).toBe(
            "/c/image/upload/f_auto,q_auto,c_limit,w_640/a/b%20c"
        );
        expect(new URL(buildImageUrl("c", "a/b")).pathname).toBe(
            "/c/image/upload/f_auto,q_auto/a/b"
        );
    });
});

describe("CloudinaryImage", () => {
    beforeEach(() => {
        envMock.cloudinaryCloudName = "demo-cloud";
        envMock.isDev = true;
    });

    it("emits a responsive srcset of fixed widths with f_auto,q_auto", () => {
        render(
            <CloudinaryImage
                publicId={ID}
                alt="Quiz review screen"
                width={1600}
                height={900}
                sizes="50vw"
            />
        );
        const image = screen.getByRole("img", { name: "Quiz review screen" });
        const srcset = image.getAttribute("srcset");
        expect(srcset).toContain("w_320");
        expect(srcset).toContain("w_1280");
        expect(srcset).toContain("w_1600");
        expect(srcset).toContain("1600w");
        expect(srcset).toContain("f_auto,q_auto,c_limit");
        expect(image).toHaveAttribute("sizes", "50vw");
        expect(image).toHaveAttribute("width", "1600");
        expect(image).toHaveAttribute("height", "900");
    });

    it("never asks for widths above the asset width", () => {
        render(
            <CloudinaryImage
                publicId={ID}
                alt="Small"
                width={500}
                height={500}
            />
        );
        const srcset = screen
            .getByRole("img", { name: "Small" })
            .getAttribute("srcset");
        expect(srcset).toContain("500w");
        expect(srcset).not.toContain("640w");
    });

    it("reserves space with an aspect-ratio box", () => {
        const { container } = render(
            <CloudinaryImage
                publicId={ID}
                alt="Wide"
                width={1600}
                height={900}
            />
        );
        expect(container.firstElementChild.getAttribute("style")).toContain(
            "--ratio: 1600 / 900"
        );
        expect(container.firstElementChild).toHaveClass("aspect-(--ratio)");
    });

    it("lazy-loads by default and eager-loads the priority image", () => {
        const { rerender } = render(
            <CloudinaryImage
                publicId={ID}
                alt="Lazy"
                width={800}
                height={600}
            />
        );
        expect(screen.getByRole("img", { name: "Lazy" })).toHaveAttribute(
            "loading",
            "lazy"
        );
        rerender(
            <CloudinaryImage
                publicId={ID}
                alt="Lazy"
                width={800}
                height={600}
                priority
            />
        );
        const image = screen.getByRole("img", { name: "Lazy" });
        expect(image).toHaveAttribute("loading", "eager");
        expect(image).toHaveAttribute("fetchpriority", "high");
    });

    it("takes alt text from the manifest slot through i18n", () => {
        render(<CloudinaryImage slot="landing.tour.mapping" publicId={ID} />);
        expect(
            screen.getByRole("img", { name: /Gap list ranking competencies/ })
        ).toBeInTheDocument();
    });

    it("renders a flat labelled placeholder while the slot has no asset", () => {
        const { container } = render(
            <CloudinaryImage slot="landing.tour.recs" />
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("[data-placeholder]")).not.toBeNull();
        expect(
            screen.getByRole("img", { name: /Recommended learning path/ })
        ).toBeInTheDocument();
        expect(container).toHaveTextContent("landing.tour.recs");
    });

    it("uses the placeholder when no cloud name is configured", () => {
        envMock.cloudinaryCloudName = "";
        const { container } = render(
            <CloudinaryImage
                publicId={ID}
                alt="No cloud"
                width={800}
                height={600}
            />
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("[data-placeholder]")).not.toBeNull();
    });

    it("renders nothing for an optional slot that is still a placeholder", () => {
        const { container } = render(
            <CloudinaryImage slot="landing.roles.learner" optional />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows a flat fallback block with an icon when the image fails", () => {
        const { container } = render(
            <CloudinaryImage
                publicId={ID}
                alt="Broken"
                width={800}
                height={600}
            />
        );
        fireEvent.error(screen.getByRole("img", { name: "Broken" }));
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("[data-error] svg")).not.toBeNull();
        expect(screen.getByRole("img", { name: "Broken" })).toBeInTheDocument();
    });

    it("warns and hides the image from assistive tech when alt is missing", () => {
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
        const { container } = render(
            <CloudinaryImage publicId={ID} width={800} height={600} />
        );
        expect(warn).toHaveBeenCalled();
        expect(container.querySelector("img")).toHaveAttribute("alt", "");
    });

    it("accepts an empty alt only when decorative", () => {
        const { container } = render(
            <CloudinaryImage
                publicId={ID}
                decorative
                width={800}
                height={600}
            />
        );
        const image = container.querySelector("img");
        expect(image).toHaveAttribute("alt", "");
    });

    it("has no axe violations", async () => {
        const { container } = render(
            <CloudinaryImage
                publicId={ID}
                alt="Accessible"
                width={800}
                height={600}
            />
        );
        await expectAccessible(container);
    });
});
