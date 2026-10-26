import { describe, expect, it } from "vitest";
import { readReturnTo, returnState, safeReturnPath } from "@/lib/safeRedirect";

describe("safeReturnPath", () => {
    it("accepts real in-app paths, with query and hash", () => {
        expect(safeReturnPath("/dashboard")).toBe("/dashboard");
        expect(safeReturnPath("/courses/abc?tab=1#top")).toBe(
            "/courses/abc?tab=1#top"
        );
        expect(safeReturnPath("/settings/sessions")).toBe("/settings/sessions");
    });

    it.each([
        ["protocol-relative", "//evil.example.test"],
        ["absolute https", "https://evil.example.test/dashboard"],
        ["javascript scheme", "javascript:alert(1)"],
        ["backslash", "/\\evil.example.test"],
        ["encoded backslash", "/%5Cevil.example.test"],
        ["encoded slash", "/%2F/evil.example.test"],
        ["tab smuggling", "/\t/evil.example.test"],
        ["newline", "/dashboard\nhttps://evil.example.test"],
        ["control char", "/dash" + String.fromCharCode(7) + "board"],
        ["line separator", "/dash" + String.fromCharCode(0x2028) + "board"],
        ["no leading slash", "dashboard"],
        ["empty", ""],
        ["too long", `/dashboard?${"a".repeat(3000)}`],
        ["auth route", "/login"],
        ["session-expired", "/session-expired"],
        ["unknown route", "/definitely-not-a-route"],
        ["double slash inside", "/dashboard//x"],
        ["colon segment", "/data:text/html"],
    ])("rejects %s", (_name, candidate) => {
        expect(safeReturnPath(candidate)).toBe("/dashboard");
    });

    it("rejects non-strings and honours a custom fallback", () => {
        expect(safeReturnPath(undefined)).toBe("/dashboard");
        expect(safeReturnPath({ a: 1 })).toBe("/dashboard");
        expect(safeReturnPath("//x", "/onboarding")).toBe("/onboarding");
        expect(safeReturnPath("//x", null)).toBeNull();
    });
});

describe("readReturnTo", () => {
    it("reads router state first, validated", () => {
        expect(
            readReturnTo({
                state: { returnTo: "/gaps" },
                search: "?returnTo=/chat",
            })
        ).toBe("/gaps");
        expect(
            readReturnTo({ state: { returnTo: "//evil.example.test" } })
        ).toBe("/dashboard");
    });

    it("falls back to the query parameter, validated", () => {
        expect(readReturnTo({ search: "?returnTo=%2Fchat" })).toBe("/chat");
        expect(
            readReturnTo({
                search: "?returnTo=https%3A%2F%2Fevil.example.test",
            })
        ).toBe("/dashboard");
    });

    it("uses the fallback when nothing is carried", () => {
        expect(readReturnTo({})).toBe("/dashboard");
        expect(readReturnTo(undefined, "/onboarding")).toBe("/onboarding");
    });
});

describe("returnState", () => {
    it("wraps the current location when it is returnable", () => {
        expect(
            returnState({ pathname: "/gaps", search: "?x=1", hash: "" })
        ).toEqual({ returnTo: "/gaps?x=1" });
    });

    it("returns undefined for auth routes or missing locations", () => {
        expect(returnState({ pathname: "/login" })).toBeUndefined();
        expect(returnState(undefined)).toBeUndefined();
    });
});
