import { describe, expect, it } from "vitest";
import {
    defineTemplate,
    escapeHtml,
    renderLayout,
} from "./emailLayout.mapper.js";

describe("escapeHtml", () => {
    it("escapes the five dangerous characters", () => {
        expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
            "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
        );
    });

    it("handles null and numbers", () => {
        expect(escapeHtml(null)).toBe("");
        expect(escapeHtml(undefined)).toBe("");
        expect(escapeHtml(42)).toBe("42");
    });
});

describe("renderLayout", () => {
    const content = {
        subject: "Subject <x>",
        heading: "Heading",
        paragraphs: ["Hello <b>Asha</b>", "Second"],
        action: { label: "Open", url: "https://app.example.test/x#token=abc" },
        note: "Ignore if not you.",
    };

    it("produces escaped HTML and a text alternative with the link", () => {
        const { html, text } = renderLayout(content);
        expect(html).toContain("Hello &lt;b&gt;Asha&lt;/b&gt;");
        expect(html).not.toContain("<b>Asha</b>");
        expect(html).toContain('href="https://app.example.test/x#token=abc"');
        expect(html).toContain("<title>Subject &lt;x&gt;</title>");
        expect(text).toContain("Open: https://app.example.test/x#token=abc");
        expect(text).toContain("Hello <b>Asha</b>");
        expect(text).toContain("Ignore if not you.");
    });

    it("is plain: no images, tracking pixels, scripts or external stylesheets", () => {
        const { html } = renderLayout(content);
        expect(html).not.toMatch(/<img|<script|<link|<iframe|url\(/i);
    });

    it("carries the prototype disclaimer and the language attribute", () => {
        const { html, text } = renderLayout({ ...content, lang: "hi" });
        expect(html).toContain('<html lang="hi">');
        expect(text).toContain("not an official Government of India website");
    });

    it("works without an action or note", () => {
        const { html, text } = renderLayout({
            subject: "S",
            heading: "H",
            paragraphs: ["P"],
        });
        expect(html).not.toContain("<a ");
        expect(text).not.toContain("undefined");
    });
});

describe("defineTemplate", () => {
    it("freezes the definition and gathers languages", () => {
        const template = defineTemplate({
            key: "k",
            required: ["a"],
            en: () => ({}),
        });
        expect(Object.isFrozen(template)).toBe(true);
        expect(template.links).toEqual([]);
        expect(Object.keys(template.languages)).toEqual(["en"]);
    });
});
