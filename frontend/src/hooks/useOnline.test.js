import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnline } from "@/hooks/useOnline";

afterEach(() => vi.restoreAllMocks());

describe("useOnline", () => {
    it("tracks online and offline events", () => {
        const onLine = vi
            .spyOn(window.navigator, "onLine", "get")
            .mockReturnValue(true);
        const { result } = renderHook(() => useOnline());
        expect(result.current).toBe(true);

        onLine.mockReturnValue(false);
        act(() => window.dispatchEvent(new Event("offline")));
        expect(result.current).toBe(false);

        onLine.mockReturnValue(true);
        act(() => window.dispatchEvent(new Event("online")));
        expect(result.current).toBe(true);
    });
});
