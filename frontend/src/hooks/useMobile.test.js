import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/hooks/useMobile";

function mockViewport(matches) {
    let listener = null;
    window.matchMedia = vi.fn((query) => ({
        matches,
        media: query,
        addEventListener: (_event, callback) => {
            listener = callback;
        },
        removeEventListener: () => {
            listener = null;
        },
    }));
    return {
        change(next) {
            matches = next;
            act(() => listener?.());
        },
    };
}

describe("useIsMobile", () => {
    it("is true below the md breakpoint", () => {
        mockViewport(true);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
        expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
    });

    it("is false from the md breakpoint up", () => {
        mockViewport(false);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);
    });

    it("follows viewport changes", () => {
        const viewport = mockViewport(false);
        const { result } = renderHook(() => useIsMobile());
        viewport.change(true);
        expect(result.current).toBe(true);
    });
});
