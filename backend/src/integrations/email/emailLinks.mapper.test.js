import { describe, expect, it } from "vitest";
import {
    buildFrontendLink,
    isFrontendLink,
    readFragmentToken,
} from "./emailLinks.mapper.js";

const BASE = "https://app.example.test";

describe("buildFrontendLink (AUTH-31, R2)", () => {
    it("puts the token in the fragment, never the query string", () => {
        const link = buildFrontendLink(
            "/verify-email",
            { token: "abc_DEF-123" },
            BASE
        );
        expect(link).toBe(
            "https://app.example.test/verify-email#token=abc_DEF-123"
        );
        expect(new URL(link).search).toBe("");
    });

    it("builds from the configured FRONTEND_URL by default", () => {
        expect(buildFrontendLink("/reset-password", { token: "t" })).toBe(
            "http://localhost:5173/reset-password#token=t"
        );
    });

    it("percent-encodes unusual token characters", () => {
        expect(
            buildFrontendLink("/accept-invite", { token: "a b&c#d" }, BASE)
        ).toContain("#token=a%20b%26c%23d");
        expect(
            readFragmentToken(
                buildFrontendLink("/accept-invite", { token: "a b&c#d" }, BASE)
            )
        ).toBe("a b&c#d");
    });

    it("builds a plain link without a token and supports harmless params", () => {
        expect(buildFrontendLink("/login", {}, BASE)).toBe(
            "https://app.example.test/login"
        );
        expect(
            buildFrontendLink(
                "/settings/sessions",
                { params: { from: "email" } },
                BASE
            )
        ).toBe("https://app.example.test/settings/sessions?from=email");
    });

    it("refuses secret-looking query parameters", () => {
        for (const key of [
            "token",
            "access_token",
            "jwt",
            "password",
            "sessionId",
        ]) {
            expect(() =>
                buildFrontendLink("/x", { params: { [key]: "v" } }, BASE)
            ).toThrow(TypeError);
        }
    });

    it.each([
        "//evil.example",
        "https://evil.example/x",
        "/..//evil",
        "/a b",
        "javascript:alert(1)",
        "login",
        "/path?x=1",
        "\\evil",
        "",
    ])("refuses the unsafe path %j", (path) => {
        expect(() => buildFrontendLink(path, {}, BASE)).toThrow(TypeError);
    });

    it("keeps the origin of the base even with a base that has a path-less trailing slash", () => {
        expect(
            buildFrontendLink(
                "/verify-email",
                { token: "t" },
                `${BASE}/`
            ).startsWith(BASE)
        ).toBe(true);
    });
});

describe("isFrontendLink", () => {
    it("accepts links on the frontend origin only", () => {
        expect(isFrontendLink("https://app.example.test/x#token=1", BASE)).toBe(
            true
        );
        expect(isFrontendLink("https://evil.example/x", BASE)).toBe(false);
        expect(
            isFrontendLink("https://app.example.test.evil.example/x", BASE)
        ).toBe(false);
        expect(isFrontendLink("http://app.example.test/x", BASE)).toBe(false);
        expect(isFrontendLink("not a url", BASE)).toBe(false);
        expect(isFrontendLink(undefined, BASE)).toBe(false);
    });
});

describe("readFragmentToken", () => {
    it("reads the token or returns null", () => {
        expect(readFragmentToken("https://app.example.test/x#token=abc")).toBe(
            "abc"
        );
        expect(
            readFragmentToken("https://app.example.test/x?token=abc")
        ).toBeNull();
        expect(readFragmentToken("https://app.example.test/x")).toBeNull();
        expect(readFragmentToken("garbage")).toBeNull();
    });
});
