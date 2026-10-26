import { describe, expect, it } from "vitest";
import {
    SITE_CONFIG,
    absoluteUrl,
    getSiteUrl,
} from "@/features/marketing/data/siteConfig";

describe("siteConfig", () => {
    it("builds absolute URLs from the page origin without double slashes", () => {
        expect(getSiteUrl()).toBe(window.location.origin);
        expect(absoluteUrl("/about")).toBe(`${window.location.origin}/about`);
        expect(absoluteUrl("about")).toBe(`${window.location.origin}/about`);
        expect(absoluteUrl()).toBe(`${window.location.origin}/`);
    });

    it("holds only public placeholders", () => {
        expect(SITE_CONFIG.supportEmail).toMatch(/@example\.test$/);
        expect(SITE_CONFIG.ogImageSlot).toBe("landing.og.default");
    });
});
