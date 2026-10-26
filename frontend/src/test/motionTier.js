import { vi } from "vitest";

const LITE_QUERY = /max-width|pointer: coarse|max-height/;

/**
 * Makes `useMotionTier` resolve to `full`, `lite` or `reduced` in a test by faking matchMedia.
 * Call it in `beforeEach`; it is reset by the next call.
 */
export function setMotionTier(tier) {
    window.matchMedia = (query) => ({
        matches:
            tier === "reduced"
                ? /prefers-reduced-motion/.test(query)
                : tier === "lite" && LITE_QUERY.test(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    });
}

export const MOTION_TIER_CASES = ["full", "lite", "reduced"];

/** Replaces IntersectionObserver with a stub that reports every observed element as visible. */
export function stubIntersectionVisible() {
    class VisibleObserver {
        constructor(callback) {
            this.callback = callback;
        }
        observe(target) {
            queueMicrotask(() =>
                this.callback(
                    [{ isIntersecting: true, intersectionRatio: 1, target }],
                    this
                )
            );
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return [];
        }
    }
    window.IntersectionObserver = VisibleObserver;
}
