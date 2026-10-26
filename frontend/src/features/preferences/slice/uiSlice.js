import { createSlice } from "@reduxjs/toolkit";
import { detectLanguage, isSupportedLanguage } from "@/lib/format";
import { storage } from "@/lib/storage";

export const THEMES = Object.freeze(["light", "dark", "system"]);

const isTheme = (value) => THEMES.includes(value);

/** Validated lazy initial state: storage may hold anything, so every value is checked (FE-15). */
export function loadUiState() {
    const storedTheme = storage.get("sai-theme");
    return {
        theme: isTheme(storedTheme) ? storedTheme : "system",
        language: detectLanguage(),
        sidebarCollapsed: storage.get("sai-sidebar") === "collapsed",
        offline: false,
        serverWaking: false,
    };
}

const uiSlice = createSlice({
    name: "ui",
    initialState: loadUiState,
    reducers: {
        themeChanged(state, { payload }) {
            if (isTheme(payload)) state.theme = payload;
        },
        languageChanged(state, { payload }) {
            if (isSupportedLanguage(payload)) state.language = payload;
        },
        languageSynced(state, { payload }) {
            if (isSupportedLanguage(payload)) state.language = payload;
        },
        sidebarToggled(state) {
            state.sidebarCollapsed = !state.sidebarCollapsed;
        },
        sidebarSet(state, { payload }) {
            state.sidebarCollapsed = Boolean(payload);
        },
        offlineChanged(state, { payload }) {
            state.offline = Boolean(payload);
        },
        serverWakingChanged(state, { payload }) {
            state.serverWaking = Boolean(payload);
        },
    },
});

export const {
    themeChanged,
    languageChanged,
    languageSynced,
    sidebarToggled,
    sidebarSet,
    offlineChanged,
    serverWakingChanged,
} = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

export const selectTheme = (state) => state.ui.theme;
export const selectLanguage = (state) => state.ui.language;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectOffline = (state) => state.ui.offline;
export const selectServerWaking = (state) => state.ui.serverWaking;
