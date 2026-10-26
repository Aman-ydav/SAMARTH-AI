import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setupStore } from "@/app/store";
import {
    THEMES,
    languageChanged,
    languageSynced,
    loadUiState,
    offlineChanged,
    selectLanguage,
    selectOffline,
    selectServerWaking,
    selectSidebarCollapsed,
    selectTheme,
    serverWakingChanged,
    sidebarSet,
    sidebarToggled,
    themeChanged,
} from "@/features/preferences";
import { i18n } from "@/i18n";

afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
});

describe("initial state from storage", () => {
    it("defaults to the system theme, English and an expanded sidebar", () => {
        expect(loadUiState()).toEqual({
            theme: "system",
            language: "en",
            sidebarCollapsed: false,
            offline: false,
            serverWaking: false,
        });
    });

    it("reads valid persisted values", () => {
        localStorage.setItem("sai-theme", "dark");
        localStorage.setItem("sai-lang", "hi");
        localStorage.setItem("sai-sidebar", "collapsed");
        expect(loadUiState()).toMatchObject({
            theme: "dark",
            language: "hi",
            sidebarCollapsed: true,
        });
    });

    it("ignores tampered or invalid persisted values", () => {
        localStorage.setItem("sai-theme", "neon");
        localStorage.setItem("sai-lang", "xx");
        localStorage.setItem("sai-sidebar", "<script>");
        expect(loadUiState()).toMatchObject({
            theme: "system",
            language: "en",
            sidebarCollapsed: false,
        });
    });
});

describe("reducers", () => {
    it("changes the theme only to a known value", () => {
        const store = setupStore();
        for (const theme of THEMES) {
            store.dispatch(themeChanged(theme));
            expect(selectTheme(store.getState())).toBe(theme);
        }
        store.dispatch(themeChanged("neon"));
        expect(selectTheme(store.getState())).toBe("system");
    });

    it("changes the language only to a supported one", () => {
        const store = setupStore();
        store.dispatch(languageChanged("hi"));
        expect(selectLanguage(store.getState())).toBe("hi");
        store.dispatch(languageChanged("fr"));
        store.dispatch(languageSynced("de"));
        expect(selectLanguage(store.getState())).toBe("hi");
    });

    it("toggles and sets the sidebar", () => {
        const store = setupStore();
        store.dispatch(sidebarToggled());
        expect(selectSidebarCollapsed(store.getState())).toBe(true);
        store.dispatch(sidebarSet(false));
        expect(selectSidebarCollapsed(store.getState())).toBe(false);
    });

    it("tracks the offline and server-waking banners", () => {
        const store = setupStore();
        store.dispatch(offlineChanged(true));
        store.dispatch(serverWakingChanged(true));
        expect(selectOffline(store.getState())).toBe(true);
        expect(selectServerWaking(store.getState())).toBe(true);
        store.dispatch(offlineChanged(false));
        expect(selectOffline(store.getState())).toBe(false);
    });
});

describe("persistence and side effects (listeners)", () => {
    it("persists the theme, language and sidebar choices", () => {
        const store = setupStore();
        store.dispatch(themeChanged("dark"));
        store.dispatch(languageChanged("hi"));
        store.dispatch(sidebarToggled());
        expect(localStorage.getItem("sai-theme")).toBe("dark");
        expect(localStorage.getItem("sai-lang")).toBe("hi");
        expect(localStorage.getItem("sai-sidebar")).toBe("collapsed");
        store.dispatch(sidebarToggled());
        expect(localStorage.getItem("sai-sidebar")).toBe("expanded");
    });

    it("switches the i18n language and the document language", async () => {
        const store = setupStore();
        store.dispatch(languageChanged("hi"));
        await waitFor(() => expect(i18n.language).toBe("hi"));
        expect(document.documentElement.lang).toBe("hi");
    });

    it("applies a synced language without persisting it as the user's choice", async () => {
        const store = setupStore();
        store.dispatch(languageSynced("hi"));
        await waitFor(() => expect(i18n.language).toBe("hi"));
        expect(localStorage.getItem("sai-lang")).toBeNull();
    });

    it("does not persist unrelated slices", () => {
        const store = setupStore();
        store.dispatch(offlineChanged(true));
        expect(localStorage.length).toBe(0);
    });
});
