import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTheme } from "@/features/preferences";
import { renderHookWithProviders } from "@/test/renderWithProviders";

afterEach(() => localStorage.clear());

describe("useTheme", () => {
    it("exposes the choice, the concrete theme and a setter", () => {
        const { result } = renderHookWithProviders(() => useTheme());
        expect(result.current.theme).toBe("system");
        act(() => result.current.setTheme("dark"));
        expect(result.current).toMatchObject({
            theme: "dark",
            resolvedTheme: "dark",
        });
        expect(localStorage.getItem("sai-theme")).toBe("dark");
    });
});
