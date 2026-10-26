import { describe, expect, it } from "vitest";
import {
    getClientIp,
    getIpHash,
    getUserAgent,
    getUserAgentHash,
} from "./clientInfo.js";
import { hmacIdentifier } from "./hash.js";

describe("clientInfo", () => {
    it("reads the IP Express resolved and never forwarded headers", () => {
        expect(
            getClientIp({
                ip: "203.0.113.9",
                headers: { "x-forwarded-for": "1.1.1.1" },
            })
        ).toBe("203.0.113.9");
        expect(getClientIp({})).toBe("");
    });

    it("stores only an HMAC of the IP (R37), 64 hex characters", () => {
        const hash = getIpHash({ ip: "203.0.113.9" });
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).toBe(hmacIdentifier("203.0.113.9"));
        expect(hash).not.toContain("203");
    });

    it("truncates the user agent to 200 characters", () => {
        expect(
            getUserAgent({ headers: { "user-agent": "x".repeat(500) } })
        ).toHaveLength(200);
        expect(getUserAgent({ headers: {} })).toBe("");
        expect(getUserAgent({})).toBe("");
    });

    it("hashes the user agent for new-device detection", () => {
        const a = getUserAgentHash({ headers: { "user-agent": "Browser A" } });
        const b = getUserAgentHash({ headers: { "user-agent": "Browser B" } });
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(a).not.toBe(b);
        expect(
            getUserAgentHash({ headers: { "user-agent": "Browser A" } })
        ).toBe(a);
    });
});
