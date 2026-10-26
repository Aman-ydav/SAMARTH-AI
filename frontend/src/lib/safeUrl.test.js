import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/safeUrl";

describe("safeExternalUrl", () => {
    it("allows https, mailto and tel", () => {
        expect(safeExternalUrl("https://example.test/path?q=1")).toBe(
            "https://example.test/path?q=1"
        );
        expect(safeExternalUrl("mailto:help@example.test")).toBe(
            "mailto:help@example.test"
        );
        expect(safeExternalUrl("tel:+911234567890")).toBe("tel:+911234567890");
    });

    it.each([
        "http://example.test",
        "javascript:alert(1)",
        "data:text/html,<b>x</b>",
        "ftp://example.test",
        "//example.test",
        "/relative",
        "not a url",
        "",
        "   ",
        null,
        undefined,
        12,
    ])("rejects %s", (value) => {
        expect(safeExternalUrl(value)).toBeNull();
    });

    it("rejects credentials in https urls and over-long values", () => {
        expect(safeExternalUrl("https://user:pass@example.test")).toBeNull();
        expect(
            safeExternalUrl(`https://example.test/${"a".repeat(3000)}`)
        ).toBeNull();
    });
});
