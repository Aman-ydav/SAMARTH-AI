import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRevalidateOnFocus } from "@/hooks/useRevalidateOnFocus";

function setVisibility(state) {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
});

describe("useRevalidateOnFocus", () => {
    it("revalidates when the tab becomes visible after the idle window", () => {
        const revalidate = vi.fn();
        renderHook(() => useRevalidateOnFocus(revalidate));
        vi.setSystemTime(Date.now() + 6 * 60 * 1000);
        setVisibility("visible");
        expect(revalidate).toHaveBeenCalledTimes(1);
    });

    it("does nothing inside the idle window or while hidden", () => {
        const revalidate = vi.fn();
        renderHook(() =>
            useRevalidateOnFocus(revalidate, { minIdleMs: 60000 })
        );
        vi.setSystemTime(Date.now() + 30000);
        setVisibility("visible");
        vi.setSystemTime(Date.now() + 120000);
        setVisibility("hidden");
        expect(revalidate).not.toHaveBeenCalled();
    });

    it("uses the latest callback", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(
            ({ callback }) =>
                useRevalidateOnFocus(callback, { minIdleMs: 1000 }),
            { initialProps: { callback: first } }
        );
        rerender({ callback: second });
        vi.setSystemTime(Date.now() + 2000);
        setVisibility("visible");
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
