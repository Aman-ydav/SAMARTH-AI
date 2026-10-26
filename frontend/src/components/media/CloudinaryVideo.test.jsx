import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudinaryVideo } from "@/components/media/CloudinaryVideo";
import { loadAllNamespaces } from "@/i18n";
import { expectAccessible } from "@/test/axeCheck";
import { setMotionTier } from "@/test/motionTier";

await loadAllNamespaces();

const envMock = vi.hoisted(() => ({
    cloudinaryCloudName: "demo-cloud",
    isDev: true,
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

const VIDEO = "samarth-ai/prod/marketing/intro";
const POSTER = "samarth-ai/prod/marketing/intro-poster";

function setSaveData(value) {
    Object.defineProperty(navigator, "connection", {
        value: value === undefined ? undefined : { saveData: value },
        configurable: true,
    });
}

describe("CloudinaryVideo", () => {
    let play;
    let pause;

    beforeEach(() => {
        envMock.cloudinaryCloudName = "demo-cloud";
        setMotionTier("full");
        play = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockResolvedValue(undefined);
        pause = vi
            .spyOn(HTMLMediaElement.prototype, "pause")
            .mockImplementation(() => {});
    });
    afterEach(() => setSaveData(undefined));

    it("builds a f_auto,q_auto source with a poster and no preload", () => {
        const { container } = render(
            <CloudinaryVideo
                publicId={VIDEO}
                poster={POSTER}
                width={1280}
                height={720}
                label="Product introduction"
            />
        );
        const video = container.querySelector("video");
        expect(video.getAttribute("src")).toContain(
            "/video/upload/f_auto,q_auto/"
        );
        expect(video.getAttribute("poster")).toContain(
            "/image/upload/f_auto,q_auto"
        );
        expect(video).toHaveAttribute("preload", "none");
        expect(video).toHaveAttribute("controls");
        expect(video).toHaveAttribute("aria-label", "Product introduction");
        expect(container.firstElementChild.getAttribute("style")).toContain(
            "--ratio: 1280 / 720"
        );
    });

    it("preloads metadata only for the hero video", () => {
        const { container } = render(
            <CloudinaryVideo
                publicId={VIDEO}
                poster={POSTER}
                hero
                label="Hero"
            />
        );
        expect(container.querySelector("video")).toHaveAttribute(
            "preload",
            "metadata"
        );
    });

    it("renders a captions track when provided", () => {
        const { container } = render(
            <CloudinaryVideo
                publicId={VIDEO}
                poster={POSTER}
                label="With captions"
                captions={{
                    src: "/captions.vtt",
                    srcLang: "en",
                    label: "English",
                }}
            />
        );
        const track = container.querySelector("track");
        expect(track).toHaveAttribute("kind", "captions");
        expect(track).toHaveAttribute("srclang", "en");
    });

    it("plays a muted, looping, playsinline decorative video on the full tier", () => {
        const { container } = render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} decorativeLoop />
        );
        const video = container.querySelector("video");
        expect(video.muted).toBe(true);
        expect(video).toHaveAttribute("loop");
        expect(video).toHaveAttribute("playsinline");
        expect(video).toHaveAttribute("aria-hidden", "true");
        expect(video).not.toHaveAttribute("controls");
        expect(play).toHaveBeenCalled();
    });

    it("does not autoplay under reduced motion", () => {
        setMotionTier("reduced");
        render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} decorativeLoop />
        );
        expect(play).not.toHaveBeenCalled();
    });

    it("does not autoplay when the browser asks to save data", () => {
        setSaveData(true);
        render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} decorativeLoop />
        );
        expect(play).not.toHaveBeenCalled();
    });

    it("pauses when the tab is hidden", () => {
        render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} decorativeLoop />
        );
        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(pause).toHaveBeenCalled();
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
    });

    it("shows the poster and a message when the video fails", () => {
        const { container } = render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} label="Broken" />
        );
        fireEvent.error(container.querySelector("video"));
        expect(container.querySelector("video")).toBeNull();
        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            expect.stringContaining(POSTER)
        );
        expect(
            screen.getByText("This video could not be loaded.")
        ).toBeInTheDocument();
    });

    it("renders a flat placeholder without a cloud name", () => {
        envMock.cloudinaryCloudName = "";
        const { container } = render(
            <CloudinaryVideo publicId={VIDEO} poster={POSTER} label="Missing" />
        );
        expect(container.querySelector("video")).toBeNull();
        expect(container.querySelector("[data-placeholder]")).not.toBeNull();
    });

    it("has no axe violations", async () => {
        const { container } = render(
            <CloudinaryVideo
                publicId={VIDEO}
                poster={POSTER}
                label="Product introduction"
                captions={{
                    src: "/captions.vtt",
                    srcLang: "en",
                    label: "English",
                }}
            />
        );
        await expectAccessible(container);
    });
});
