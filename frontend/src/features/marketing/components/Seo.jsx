import { useEffect } from "react";
import { env } from "@/lib/env";

const MARK = "data-seo";

/* Creates or updates one head tag and returns an undo function that restores the previous state. */
function upsert(selector, create, update) {
    let node = document.head.querySelector(selector);
    if (node) {
        const snapshot = node.cloneNode(true);
        update(node);
        return () => {
            for (const { name } of [...node.attributes])
                node.removeAttribute(name);
            for (const { name, value } of snapshot.attributes)
                node.setAttribute(name, value);
        };
    }
    node = create();
    node.setAttribute(MARK, "");
    update(node);
    document.head.appendChild(node);
    return () => node.remove();
}

function metaTag(attribute, key, content) {
    return upsert(
        `meta[${attribute}="${key}"]`,
        () => {
            const node = document.createElement("meta");
            node.setAttribute(attribute, key);
            return node;
        },
        (node) => node.setAttribute("content", content)
    );
}

function linkTag(rel, href) {
    return upsert(
        `link[rel="${rel}"]`,
        () => {
            const node = document.createElement("link");
            node.setAttribute("rel", rel);
            return node;
        },
        (node) => node.setAttribute("href", href)
    );
}

function jsonLdTag(text) {
    const node = document.createElement("script");
    node.type = "application/ld+json";
    node.setAttribute(MARK, "");
    node.textContent = text.replace(/</g, "\\u003c");
    document.head.appendChild(node);
    return () => node.remove();
}

function keepTitle(title) {
    const previous = document.title;
    const titleNode = document.head.querySelector("title");
    const apply = () => {
        if (document.title !== title) document.title = title;
    };
    apply();
    const observer = titleNode ? new MutationObserver(apply) : null;
    observer?.observe(titleNode, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    return () => {
        observer?.disconnect();
        document.title = previous;
    };
}

function applyTags({
    title,
    description,
    url,
    image,
    imageAlt,
    locale,
    alternateLocale,
    robots,
    jsonLdText,
    type,
    siteName,
    twitterCard,
}) {
    const undo = [keepTitle(title)];
    const add = (fn, ...args) => undo.push(fn(...args));
    add(metaTag, "name", "description", description);
    add(metaTag, "name", "robots", robots);
    add(linkTag, "canonical", url);
    add(metaTag, "property", "og:type", type);
    add(metaTag, "property", "og:title", title);
    add(metaTag, "property", "og:description", description);
    add(metaTag, "property", "og:url", url);
    add(metaTag, "property", "og:site_name", siteName);
    add(metaTag, "property", "og:locale", locale);
    if (alternateLocale)
        add(metaTag, "property", "og:locale:alternate", alternateLocale);
    add(metaTag, "name", "twitter:card", twitterCard);
    add(metaTag, "name", "twitter:title", title);
    add(metaTag, "name", "twitter:description", description);
    if (image) {
        add(metaTag, "property", "og:image", image);
        add(metaTag, "name", "twitter:image", image);
        if (imageAlt) {
            add(metaTag, "property", "og:image:alt", imageAlt);
            add(metaTag, "name", "twitter:image:alt", imageAlt);
        }
    }
    if (jsonLdText) undo.push(jsonLdTag(jsonLdText));
    return () => undo.reverse().forEach((fn) => fn());
}

/**
 * Document head for a public page: title, description, canonical, robots, Open Graph, Twitter card and optional
 * JSON-LD (docs/23 SEO block; EDGE-114). Renders nothing and restores the previous head on unmount.
 * `VITE_ALLOW_INDEXING=false` forces `noindex, nofollow`. `image` is an absolute URL or omitted.
 */
export function Seo({
    title,
    description,
    url,
    image,
    imageAlt,
    locale = "en_IN",
    alternateLocale,
    noindex = false,
    jsonLd,
    type = "website",
    siteName = "SAMARTH AI",
    twitterCard = "summary_large_image",
}) {
    const robots =
        noindex || !env.allowIndexing ? "noindex, nofollow" : "index, follow";
    const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : "";

    useEffect(
        () =>
            applyTags({
                title,
                description,
                url,
                image,
                imageAlt,
                locale,
                alternateLocale,
                robots,
                jsonLdText,
                type,
                siteName,
                twitterCard,
            }),
        [
            title,
            description,
            url,
            image,
            imageAlt,
            locale,
            alternateLocale,
            robots,
            jsonLdText,
            type,
            siteName,
            twitterCard,
        ]
    );

    return null;
}
