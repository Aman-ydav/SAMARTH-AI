import { describe, expect, it } from "vitest";
import { summarizeUserAgent } from "./userAgent.js";

describe("summarizeUserAgent", () => {
    it.each([
        [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Chrome on Windows",
        ],
        [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0",
            "Edge on Windows",
        ],
        [
            "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
            "Firefox on Linux",
        ],
        [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
            "Safari on macOS",
        ],
        [
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
            "Chrome on Android",
        ],
        ["curl/8.4.0", "curl"],
        ["PostmanRuntime/7.37", "Postman"],
        ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", "iOS"],
    ])("labels %s", (userAgent, label) => {
        expect(summarizeUserAgent(userAgent)).toBe(label);
    });

    it("never returns the raw header and handles empty input", () => {
        expect(summarizeUserAgent("")).toBe("Unknown device");
        expect(summarizeUserAgent(undefined)).toBe("Unknown device");
        expect(summarizeUserAgent("<script>alert(1)</script>")).toBe(
            "Unknown device"
        );
    });
});
