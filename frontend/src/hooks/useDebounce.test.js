import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "@/hooks/useDebounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebounce", () => {
    it("publishes the latest value only after the delay", () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: "a" } }
        );
        rerender({ value: "ab" });
        rerender({ value: "abc" });
        expect(result.current).toBe("a");
        act(() => vi.advanceTimersByTime(299));
        expect(result.current).toBe("a");
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe("abc");
    });

    it("defaults to 300 ms", () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value),
            { initialProps: { value: 1 } }
        );
        rerender({ value: 2 });
        act(() => vi.advanceTimersByTime(300));
        expect(result.current).toBe(2);
    });
});
