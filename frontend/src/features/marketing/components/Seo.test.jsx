import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Seo } from "@/features/marketing/components/Seo";

const envMock = vi.hoisted(() => ({ allowIndexing: true }));
vi.mock("@/lib/env", () => ({ env: envMock }));

const BASE = {
    title: "SAMARTH AI | Competency Intelligence for Official Statistics",
    description: "Prototype platform for official statistics skills.",
    url: "https://app.example.test/",
    image: "https://img.example.test/og.png",
    imageAlt: "Wordmark",
};

const meta = (selector) =>
    document.head.querySelector(selector)?.getAttribute("content");

describe("Seo", () => {
    beforeEach(() => {
        envMock.allowIndexing = true;
        document.head.innerHTML = "<title>Original</title>";
        document.title = "Original";
    });

    it("sets the title, description, canonical and robots", () => {
        render(<Seo {...BASE} />);
        expect(document.title).toBe(BASE.title);
        expect(meta('meta[name="description"]')).toBe(BASE.description);
        expect(
            document.head.querySelector('link[rel="canonical"]')
        ).toHaveAttribute("href", BASE.url);
        expect(meta('meta[name="robots"]')).toBe("index, follow");
    });

    it("sets Open Graph and Twitter card tags", () => {
        render(<Seo {...BASE} locale="en_IN" alternateLocale="hi_IN" />);
        expect(meta('meta[property="og:type"]')).toBe("website");
        expect(meta('meta[property="og:title"]')).toBe(BASE.title);
        expect(meta('meta[property="og:description"]')).toBe(BASE.description);
        expect(meta('meta[property="og:url"]')).toBe(BASE.url);
        expect(meta('meta[property="og:site_name"]')).toBe("SAMARTH AI");
        expect(meta('meta[property="og:locale"]')).toBe("en_IN");
        expect(meta('meta[property="og:locale:alternate"]')).toBe("hi_IN");
        expect(meta('meta[property="og:image"]')).toBe(BASE.image);
        expect(meta('meta[property="og:image:alt"]')).toBe(BASE.imageAlt);
        expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
        expect(meta('meta[name="twitter:title"]')).toBe(BASE.title);
        expect(meta('meta[name="twitter:image"]')).toBe(BASE.image);
    });

    it("omits image tags when there is no image yet", () => {
        render(<Seo {...BASE} image={undefined} imageAlt={undefined} />);
        expect(
            document.head.querySelector('meta[property="og:image"]')
        ).toBeNull();
        expect(
            document.head.querySelector('meta[name="twitter:image"]')
        ).toBeNull();
    });

    it("forces noindex when indexing is disabled or the page asks for it", () => {
        envMock.allowIndexing = false;
        const { unmount } = render(<Seo {...BASE} />);
        expect(meta('meta[name="robots"]')).toBe("noindex, nofollow");
        unmount();
        envMock.allowIndexing = true;
        render(<Seo {...BASE} noindex />);
        expect(meta('meta[name="robots"]')).toBe("noindex, nofollow");
    });

    it("writes JSON-LD as inert text and escapes angle brackets", () => {
        const jsonLd = {
            "@context": "https://schema.org",
            name: "</script><b>",
        };
        render(<Seo {...BASE} jsonLd={jsonLd} />);
        const script = document.head.querySelector(
            'script[type="application/ld+json"]'
        );
        expect(script.textContent).not.toContain("</script>");
        expect(JSON.parse(script.textContent).name).toBe("</script><b>");
    });

    it("updates an existing description tag and restores it on unmount", () => {
        document.head.insertAdjacentHTML(
            "beforeend",
            '<meta name="description" content="Static description">'
        );
        const { unmount } = render(<Seo {...BASE} />);
        expect(
            document.head.querySelectorAll('meta[name="description"]')
        ).toHaveLength(1);
        expect(meta('meta[name="description"]')).toBe(BASE.description);
        unmount();
        expect(meta('meta[name="description"]')).toBe("Static description");
        expect(document.title).toBe("Original");
    });

    it("removes the tags it added on unmount", () => {
        const { unmount } = render(<Seo {...BASE} jsonLd={{ name: "x" }} />);
        unmount();
        expect(document.head.querySelector("[data-seo]")).toBeNull();
    });

    it("keeps its title when another component overwrites document.title", async () => {
        render(<Seo {...BASE} />);
        document.title = "Overwritten by the route";
        await vi.waitFor(() => expect(document.title).toBe(BASE.title));
    });

    it("updates the tags when the props change", () => {
        const { rerender } = render(<Seo {...BASE} />);
        rerender(<Seo {...BASE} title="Hindi title" locale="hi_IN" />);
        expect(document.title).toBe("Hindi title");
        expect(meta('meta[property="og:locale"]')).toBe("hi_IN");
    });
});
