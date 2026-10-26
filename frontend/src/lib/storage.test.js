import { afterEach, describe, expect, it, vi } from "vitest";
import { storage } from "@/lib/storage";

afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

describe("storage", () => {
    it("round-trips the allowed persistent keys", () => {
        expect(storage.get("sai-theme")).toBeNull();
        expect(storage.set("sai-theme", "dark")).toBe(true);
        expect(storage.get("sai-theme")).toBe("dark");
        expect(localStorage.getItem("sai-theme")).toBe("dark");
        expect(storage.remove("sai-theme")).toBe(true);
        expect(storage.get("sai-theme", "system")).toBe("system");
    });

    it("keeps tab-scoped keys out of persistent storage", () => {
        storage.set("sai-return-to", "/dashboard");
        storage.set("sai-chunk-reload", "1");
        storage.set("sai-quiz-draft:abc", "{}");
        expect(sessionStorage.getItem("sai-return-to")).toBe("/dashboard");
        expect(localStorage.getItem("sai-return-to")).toBeNull();
        expect(storage.get("sai-quiz-draft:abc")).toBe("{}");
    });

    it("refuses any key outside the allow-list, including token-like names", () => {
        for (const key of [
            "accessToken",
            "sai_access",
            "refresh",
            "csrf",
            "sai-other",
            "sai-quiz-draft:",
            "",
            undefined,
        ]) {
            expect(storage.set(key, "x")).toBe(false);
            expect(storage.get(key, "fallback")).toBe("fallback");
            expect(storage.remove(key)).toBe(false);
        }
        expect(localStorage.length).toBe(0);
        expect(sessionStorage.length).toBe(0);
    });

    it("degrades to the fallback when storage throws", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota");
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(storage.get("sai-lang", "en")).toBe("en");
        expect(storage.set("sai-lang", "hi")).toBe(false);
        expect(storage.remove("sai-lang")).toBe(false);
    });
});
