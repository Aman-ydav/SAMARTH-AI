import { describe, expect, it } from "vitest";
import { env, parseEnv } from "@/lib/env";

describe("parseEnv", () => {
    it("defaults to the same-site API path", () => {
        const parsed = parseEnv(
            {},
            { DEV: false, PROD: true, MODE: "production" }
        );
        expect(parsed.apiUrl).toBe(env.apiUrl);
        expect(parsed.googleEnabled).toBe(false);
        expect(parsed.allowIndexing).toBe(true);
        expect(parsed.isProd).toBe(true);
    });

    it("accepts relative and absolute API urls and trims trailing slashes", () => {
        expect(parseEnv({ VITE_API_URL: "/custom/v2/" }).apiUrl).toBe(
            "/custom/v2"
        );
        expect(
            parseEnv({ VITE_API_URL: "https://api.example.test/api/" }).apiUrl
        ).toBe("https://api.example.test/api");
    });

    it("falls back to the default for an invalid API url", () => {
        expect(parseEnv({ VITE_API_URL: "not a url" }).apiUrl).toBe(env.apiUrl);
    });

    it("exposes the Google client id and indexing flag", () => {
        const parsed = parseEnv({
            VITE_GOOGLE_CLIENT_ID: " client-id ",
            VITE_ALLOW_INDEXING: "false",
        });
        expect(parsed.googleClientId).toBe("client-id");
        expect(parsed.googleEnabled).toBe(true);
        expect(parsed.allowIndexing).toBe(false);
    });

    it("returns a frozen object", () => {
        expect(Object.isFrozen(parseEnv({}))).toBe(true);
        expect(Object.isFrozen(env)).toBe(true);
    });

    it("reports test mode", () => {
        expect(parseEnv({}, { MODE: "test" }).isTest).toBe(true);
    });
});
