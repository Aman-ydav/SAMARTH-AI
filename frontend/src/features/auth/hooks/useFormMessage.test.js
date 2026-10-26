import { describe, expect, it } from "vitest";
import { useFormMessage } from "@/features/auth/hooks/useFormMessage";
import { NAMESPACES } from "@/i18n";
import { renderHookWithProviders } from "@/test/renderWithProviders";

const locales = import.meta.glob("/src/i18n/locales/*/*.json", {
    eager: true,
    import: "default",
});
const sources = import.meta.glob(
    [
        "/src/features/auth/**/*.jsx",
        "/src/components/layout/AuthSplitLayout.jsx",
        "!/src/**/*.test.jsx",
    ],
    { eager: true, query: "?raw", import: "default" }
);

const lookup = (language, namespace, path) =>
    path
        .split(".")
        .reduce(
            (node, part) => node?.[part],
            locales[`/src/i18n/locales/${language}/${namespace}.json`]
        );

const exists = (language, namespace, path) =>
    ["", "_one", "_other"].some(
        (suffix) =>
            typeof lookup(language, namespace, path + suffix) === "string"
    ) || Array.isArray(lookup(language, namespace, path));

/** Static keys a source file passes to t() or names as "ns:path" string literals. */
function keysUsedBy(source) {
    const first = /useTranslation\(\s*(?:\[\s*)?["'](\w+)["']/.exec(source);
    const defaultNs = first?.[1] ?? "common";
    const found = new Set();
    for (const match of source.matchAll(/\bt\(\s*"([\w:.]+)"/g)) {
        const key = match[1];
        found.add(key.includes(":") ? key : `${defaultNs}:${key}`);
    }
    const namespaces = NAMESPACES.join("|");
    for (const match of source.matchAll(
        new RegExp(`"((?:${namespaces}):[\\w.]+)"`, "g")
    ))
        found.add(match[1]);
    for (const match of source.matchAll(/i18nKey="([\w.]+)"\s+ns="(\w+)"/g))
        found.add(`${match[2]}:${match[1]}`);
    return found;
}

describe("useFormMessage", () => {
    it("translates i18n keys and passes other server text through", () => {
        const { result } = renderHookWithProviders(() => useFormMessage());
        expect(result.current("validation:email.required")).toBe(
            "Enter your email address."
        );
        expect(result.current("errors:codes.RATE_LIMITED")).toMatch(
            /Too many requests/
        );
        expect(result.current("Email domain is not recognised.")).toBe(
            "Email domain is not recognised."
        );
        expect(result.current("")).toBe("");
        expect(result.current(undefined)).toBe("");
    });
});

describe("auth UI translation keys", () => {
    const used = new Map();
    for (const [file, source] of Object.entries(sources))
        for (const key of keysUsedBy(source)) {
            used.set(key, [...(used.get(key) ?? []), file]);
        }

    it("finds the keys the auth screens use", () => {
        expect(used.size).toBeGreaterThan(80);
    });

    it.each(["en", "hi"])(
        "has every static key used by the auth screens in %s",
        (language) => {
            const missing = [...used.keys()].filter((key) => {
                const [namespace, path] = key.split(":");
                return !exists(language, namespace, path);
            });
            expect(missing).toEqual([]);
        }
    );

    it.each(["blocked", "failed"])(
        "has the dynamic Google status message %s in both languages",
        (name) => {
            for (const language of ["en", "hi"])
                expect(exists(language, "auth", `googleStatus.${name}`)).toBe(
                    true
                );
        }
    );

    it("keeps the SAMARTH topics list the same length in both languages", () => {
        expect(lookup("hi", "auth", "layout.ticker")).toHaveLength(
            lookup("en", "auth", "layout.ticker").length
        );
    });
});
