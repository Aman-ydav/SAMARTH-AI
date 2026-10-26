import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "@/hooks/useCountdown";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("useCountdown", () => {
    it("counts down to an absolute deadline", () => {
        const deadline = Date.now() + 3000;
        const { result } = renderHook(() => useCountdown(deadline));
        expect(result.current.remainingSec).toBe(3);
        expect(result.current.isRunning).toBe(true);
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current.remainingSec).toBe(2);
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current.remainingSec).toBe(0);
        expect(result.current.isRunning).toBe(false);
    });

    it("stays idle without a deadline", () => {
        const { result } = renderHook(() => useCountdown());
        expect(result.current.remainingSec).toBe(0);
        expect(result.current.isRunning).toBe(false);
    });

    it("starts a cooldown with startFor and can reset it", () => {
        const { result } = renderHook(() => useCountdown());
        act(() => result.current.startFor(60));
        expect(result.current.remainingSec).toBe(60);
        act(() => vi.advanceTimersByTime(30000));
        expect(result.current.remainingSec).toBe(30);
        act(() => result.current.reset());
        expect(result.current.remainingSec).toBe(0);
    });

    it("follows a changed initial deadline", () => {
        const { result, rerender } = renderHook(
            ({ deadline }) => useCountdown(deadline),
            { initialProps: { deadline: Date.now() + 10000 } }
        );
        expect(result.current.remainingSec).toBe(10);
        rerender({ deadline: Date.now() + 90000 });
        expect(result.current.remainingSec).toBe(90);
    });

    it("keeps the absolute deadline across a long pause (no drift from chained timeouts)", () => {
        const deadline = Date.now() + 120000;
        const { result } = renderHook(() => useCountdown(deadline));
        act(() => {
            vi.setSystemTime(Date.now() + 100000);
            vi.advanceTimersByTime(250);
        });
        expect(result.current.remainingSec).toBe(20);
    });
});
