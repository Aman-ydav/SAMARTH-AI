import { afterEach, describe, expect, it, vi } from "vitest";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { renderHookWithProviders } from "@/test/renderWithProviders";

const read = (route) =>
    renderHookWithProviders(() => useFragmentToken(), { route });

afterEach(() => {
    window.history.replaceState(null, "", "/");
});

describe("useFragmentToken", () => {
    it("reads the token from the fragment", () => {
        const { result } = read("/reset-password#token=abc123");
        expect(result.current).toEqual({ token: "abc123", hasToken: true });
    });

    it("never reads a query-string token", () => {
        const { result } = read("/reset-password?token=abc123");
        expect(result.current).toEqual({ token: null, hasToken: false });
    });

    it("keeps plus signs and decodes percent escapes", () => {
        const { result } = read("/p#x=1&token=a%2Bb+c");
        expect(result.current.token).toBe("a+b+c");
    });

    it.each([
        ["an empty token", "/p#token="],
        ["no token key", "/p#other=1"],
        ["a bad escape", "/p#token=%E0%A4%A"],
        ["an oversized token", `/p#token=${"a".repeat(513)}`],
    ])("treats %s as missing", (_name, route) => {
        expect(read(route).result.current.hasToken).toBe(false);
    });

    it("strips the fragment from the address bar, keeping path and query", () => {
        window.history.replaceState(
            null,
            "",
            "/reset-password?a=1#token=abc123"
        );
        const spy = vi.spyOn(window.history, "replaceState");
        const { result } = read("/reset-password?a=1#token=abc123");
        expect(spy).toHaveBeenCalledWith(
            window.history.state,
            "",
            "/reset-password?a=1"
        );
        expect(window.location.hash).toBe("");
        expect(window.location.search).toBe("?a=1");
        expect(result.current.token).toBe("abc123");
    });

    it("keeps the token in state across re-renders after the strip", () => {
        const { result, rerender } = read("/p#token=keepme");
        rerender();
        expect(result.current.token).toBe("keepme");
    });

    it("does not touch the address bar when there is no fragment", () => {
        const spy = vi.spyOn(window.history, "replaceState");
        read("/p");
        expect(spy).not.toHaveBeenCalled();
    });
});
