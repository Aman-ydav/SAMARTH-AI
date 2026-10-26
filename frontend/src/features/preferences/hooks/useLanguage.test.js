import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLanguage } from "@/features/preferences";
import { i18n } from "@/i18n";
import { renderHookWithProviders } from "@/test/renderWithProviders";

afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
});

describe("useLanguage", () => {
    it("switches the language, persists it and updates <html lang>", async () => {
        const { result } = renderHookWithProviders(() => useLanguage());
        expect(result.current.language).toBe("en");
        act(() => result.current.setLanguage("hi"));
        expect(result.current.language).toBe("hi");
        expect(localStorage.getItem("sai-lang")).toBe("hi");
        await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
    });
});
