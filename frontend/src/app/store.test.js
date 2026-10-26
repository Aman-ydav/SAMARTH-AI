import { describe, expect, it, vi } from "vitest";
import { setupStore, store } from "@/app/store";
import { themeChanged } from "@/features/preferences";

describe("store", () => {
    it("builds an independent store per call", () => {
        const first = setupStore();
        const second = setupStore();
        first.dispatch(themeChanged("dark"));
        expect(first.getState().ui.theme).toBe("dark");
        expect(second.getState().ui.theme).toBe("system");
    });

    it("exports a singleton for the app", () => {
        expect(store.getState()).toHaveProperty("auth");
    });

    it("accepts preloaded state for tests", () => {
        const preloaded = setupStore({
            ui: {
                theme: "light",
                language: "hi",
                sidebarCollapsed: false,
                offline: false,
                serverWaking: false,
            },
        });
        expect(preloaded.getState().ui.language).toBe("hi");
    });

    it("keeps the serializable and immutable safety checks on", () => {
        const guarded = setupStore();
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        guarded.dispatch({ type: "test/nonSerializable", payload: new Map() });
        expect(spy.mock.calls.flat().join(" ")).toMatch(/non-serializable/i);
    });
});
