import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrolled } from "@/hooks/useScrolled";

function scrollTo(y) {
    act(() => {
        Object.defineProperty(window, "scrollY", {
            value: y,
            configurable: true,
        });
        fireEvent.scroll(window);
    });
}

describe("useScrolled", () => {
    afterEach(() => scrollTo(0));

    it("is false at the top of the page", () => {
        const { result } = renderHook(() => useScrolled());
        expect(result.current).toBe(false);
    });

    it("flips to true after the threshold and back when returning to the top", () => {
        const { result } = renderHook(() => useScrolled(8));
        scrollTo(8);
        expect(result.current).toBe(false);
        scrollTo(9);
        expect(result.current).toBe(true);
        scrollTo(0);
        expect(result.current).toBe(false);
    });

    it("starts true when the page is restored below the threshold", () => {
        scrollTo(300);
        const { result } = renderHook(() => useScrolled());
        expect(result.current).toBe(true);
    });

    it("removes its listener on unmount", () => {
        const { unmount, result } = renderHook(() => useScrolled());
        unmount();
        scrollTo(500);
        expect(result.current).toBe(false);
    });
});
