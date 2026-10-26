import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    readCookiesEnabled,
    useCookiesEnabled,
} from "@/features/marketing/hooks/useCookiesEnabled";

function setCookieEnabled(value) {
    vi.spyOn(window.navigator, "cookieEnabled", "get").mockReturnValue(value);
}

describe("readCookiesEnabled", () => {
    it("is true when the browser allows cookies", () => {
        setCookieEnabled(true);
        expect(readCookiesEnabled()).toBe(true);
    });

    it("is false only when the browser reports cookies off", () => {
        setCookieEnabled(false);
        expect(readCookiesEnabled()).toBe(false);
    });

    it("never blocks on a guess: an unreadable or missing flag counts as enabled", () => {
        setCookieEnabled(undefined);
        expect(readCookiesEnabled()).toBe(true);
        vi.spyOn(window.navigator, "cookieEnabled", "get").mockImplementation(
            () => {
                throw new Error("blocked");
            }
        );
        expect(readCookiesEnabled()).toBe(true);
    });

    it("does not write or read document.cookie (FE-41)", () => {
        const getter = vi.spyOn(document, "cookie", "get");
        const setter = vi.spyOn(document, "cookie", "set");
        readCookiesEnabled();
        expect(getter).not.toHaveBeenCalled();
        expect(setter).not.toHaveBeenCalled();
    });
});

describe("useCookiesEnabled", () => {
    it("starts from the current flag and recheck picks up a change", () => {
        setCookieEnabled(false);
        const { result } = renderHook(() => useCookiesEnabled());
        expect(result.current.enabled).toBe(false);

        setCookieEnabled(true);
        let returned;
        act(() => {
            returned = result.current.recheck();
        });
        expect(returned).toBe(true);
        expect(result.current.enabled).toBe(true);
    });
});
