import { afterEach, describe, expect, it } from "vitest";
import { getCsrfToken } from "@/lib/csrf";

const expire = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

afterEach(() => {
    for (const name of ["sai_csrf", "other", "x_sai_csrf"]) expire(name);
});

describe("getCsrfToken", () => {
    it("returns an empty string when the cookie is missing", () => {
        expect(getCsrfToken()).toBe("");
    });

    it("reads sai_csrf among other cookies", () => {
        document.cookie = "other=1; path=/";
        document.cookie = "sai_csrf=abc123; path=/";
        expect(getCsrfToken()).toBe("abc123");
    });

    it("decodes percent-encoded values and tolerates malformed ones", () => {
        document.cookie = "sai_csrf=a%2Fb; path=/";
        expect(getCsrfToken()).toBe("a/b");
        document.cookie = "sai_csrf=%E0%A4%A; path=/";
        expect(getCsrfToken()).toBe("%E0%A4%A");
    });

    it("does not match cookies whose name merely contains sai_csrf", () => {
        document.cookie = "x_sai_csrf=nope; path=/";
        expect(getCsrfToken()).toBe("");
    });
});
