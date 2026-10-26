import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/renderWithProviders";
import { setupStore } from "@/app/store";
import {
    applyTheme,
    resolveTheme,
    themeChanged,
    useThemeSync,
} from "@/features/preferences";

function mockMatchMedia(initialDark) {
    const listeners = new Set();
    const media = {
        matches: initialDark,
        addEventListener: (type, listener) => listeners.add(listener),
        removeEventListener: (type, listener) => listeners.delete(listener),
    };
    window.matchMedia = vi.fn(() => media);
    return {
        media,
        setDark(next) {
            media.matches = next;
            for (const listener of listeners) listener({ matches: next });
        },
        listeners,
    };
}

const original = window.matchMedia;

beforeEach(() => document.documentElement.classList.remove("dark"));
afterEach(() => {
    window.matchMedia = original;
});

describe("resolveTheme and applyTheme", () => {
    it("resolves explicit choices and follows the OS for system", () => {
        mockMatchMedia(true);
        expect(resolveTheme("light")).toBe("light");
        expect(resolveTheme("dark")).toBe("dark");
        expect(resolveTheme("system")).toBe("dark");
        mockMatchMedia(false);
        expect(resolveTheme("system")).toBe("light");
    });

    it("toggles the dark class on <html>", () => {
        mockMatchMedia(false);
        expect(applyTheme("dark")).toBe("dark");
        expect(document.documentElement).toHaveClass("dark");
        expect(applyTheme("light")).toBe("light");
        expect(document.documentElement).not.toHaveClass("dark");
    });
});

describe("useThemeSync", () => {
    it("applies the stored theme and follows later changes", () => {
        mockMatchMedia(false);
        const store = setupStore();
        renderHookWithProviders(() => useThemeSync(), { store });
        expect(document.documentElement).not.toHaveClass("dark");
        act(() => {
            store.dispatch(themeChanged("dark"));
        });
        expect(document.documentElement).toHaveClass("dark");
    });

    it("tracks OS changes while on system and stops listening otherwise", () => {
        const os = mockMatchMedia(false);
        const store = setupStore({
            ui: {
                theme: "system",
                language: "en",
                sidebarCollapsed: false,
                offline: false,
                serverWaking: false,
            },
        });
        renderHookWithProviders(() => useThemeSync(), { store });
        expect(os.listeners.size).toBe(1);
        act(() => os.setDark(true));
        expect(document.documentElement).toHaveClass("dark");
        act(() => {
            store.dispatch(themeChanged("light"));
        });
        expect(os.listeners.size).toBe(0);
        expect(document.documentElement).not.toHaveClass("dark");
    });

    it("removes its listener on unmount", () => {
        const os = mockMatchMedia(false);
        const store = setupStore({
            ui: {
                theme: "system",
                language: "en",
                sidebarCollapsed: false,
                offline: false,
                serverWaking: false,
            },
        });
        const { unmount } = renderHookWithProviders(() => useThemeSync(), {
            store,
        });
        unmount();
        expect(os.listeners.size).toBe(0);
    });
});
