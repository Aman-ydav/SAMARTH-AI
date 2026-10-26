import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import "@/i18n";

expect.extend(axeMatchers);

afterEach(() => {
    cleanup();
});

function createMatchMedia() {
    return (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    });
}

class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
}

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (typeof window !== "undefined") {
    // jsdom has none of these browser APIs; Radix, Motion and the sidebar need them to exist.
    window.matchMedia = window.matchMedia ?? createMatchMedia();
    window.IntersectionObserver =
        window.IntersectionObserver ?? IntersectionObserverStub;
    window.ResizeObserver = window.ResizeObserver ?? ResizeObserverStub;
    window.scrollTo = vi.fn();

    Element.prototype.scrollIntoView =
        Element.prototype.scrollIntoView ?? vi.fn();
    Element.prototype.hasPointerCapture =
        Element.prototype.hasPointerCapture ?? vi.fn(() => false);
    Element.prototype.setPointerCapture =
        Element.prototype.setPointerCapture ?? vi.fn();
    Element.prototype.releasePointerCapture =
        Element.prototype.releasePointerCapture ?? vi.fn();
}

// axe-core probes canvas support; jsdom has none and would print "not implemented" for it.
if (typeof HTMLCanvasElement !== "undefined") {
    HTMLCanvasElement.prototype.getContext = () => null;
}
