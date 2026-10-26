import { describe, expect, it } from "vitest";
import { NAMESPACES, i18n, loadAllNamespaces } from "@/i18n";

const files = import.meta.glob("./locales/*/*.json", {
    eager: true,
    import: "default",
});

const MANDATORY_HI = ["common", "nav", "auth", "errors", "validation"];

function load(language, namespace) {
    return files[`./locales/${language}/${namespace}.json`];
}

function flatten(object, prefix = "", out = new Set()) {
    for (const [key, value] of Object.entries(object ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object") flatten(value, path, out);
        else out.add(path);
    }
    return out;
}

describe("locale files", () => {
    it.each(NAMESPACES)("ships valid en and hi JSON for %s", (namespace) => {
        expect(load("en", namespace)).toBeTypeOf("object");
        expect(load("hi", namespace)).toBeTypeOf("object");
    });

    it.each(MANDATORY_HI)(
        "keeps en and hi key sets identical for %s",
        (namespace) => {
            const en = flatten(load("en", namespace));
            const hi = flatten(load("hi", namespace));
            expect(en.size).toBeGreaterThan(0);
            expect([...en].filter((key) => !hi.has(key))).toEqual([]);
            expect([...hi].filter((key) => !en.has(key))).toEqual([]);
        }
    );

    it("has no empty strings in the mandatory namespaces", () => {
        for (const language of ["en", "hi"]) {
            for (const namespace of MANDATORY_HI) {
                const empty = [...flatten(load(language, namespace))].filter(
                    (key) => {
                        const value = key
                            .split(".")
                            .reduce(
                                (node, part) => node?.[part],
                                load(language, namespace)
                            );
                        return typeof value !== "string" || value.trim() === "";
                    }
                );
                expect(empty).toEqual([]);
            }
        }
    });

    it("keeps interpolation variables identical between en and hi", () => {
        const variables = (text) =>
            [...String(text).matchAll(/{{\s*(\w+)\s*}}/g)]
                .map((match) => match[1])
                .sort();
        const read = (language, namespace, path) =>
            path
                .split(".")
                .reduce(
                    (node, part) => node?.[part],
                    load(language, namespace)
                );
        for (const namespace of MANDATORY_HI) {
            for (const key of flatten(load("en", namespace))) {
                expect(
                    variables(read("hi", namespace, key)),
                    `${namespace}:${key}`
                ).toEqual(variables(read("en", namespace, key)));
            }
        }
    });

    it("provides plural pairs together", () => {
        for (const language of ["en", "hi"]) {
            for (const namespace of NAMESPACES) {
                const keys = flatten(load(language, namespace));
                for (const key of keys) {
                    if (key.endsWith("_one"))
                        expect(keys.has(key.replace(/_one$/, "_other"))).toBe(
                            true
                        );
                    if (key.endsWith("_other"))
                        expect(keys.has(key.replace(/_other$/, "_one"))).toBe(
                            true
                        );
                }
            }
        }
    });

    it("has a translation for every documented API error code", () => {
        const codes = [...flatten(load("en", "errors"))]
            .filter((key) => key.startsWith("codes."))
            .map((key) => key.slice(6));
        for (const code of [
            "INVALID_CREDENTIALS",
            "ACCOUNT_LOCKED",
            "EMAIL_NOT_VERIFIED",
            "CSRF_INVALID",
            "RATE_LIMITED",
            "TOKEN_EXPIRED",
            "REFRESH_INVALID",
            "SESSION_REVOKED",
            "RESET_TOKEN_INVALID",
            "VERIFY_TOKEN_INVALID",
            "PASSWORD_POLICY",
            "PASSWORD_REUSED",
            "OFFLINE",
            "NETWORK_ERROR",
            "TIMEOUT",
            "UNKNOWN",
            "INVALID_RESPONSE",
        ]) {
            expect(codes).toContain(code);
        }
    });
});

describe("i18n instance", () => {
    it("falls back to English and sets the document language", async () => {
        await loadAllNamespaces();
        await i18n.changeLanguage("hi");
        expect(document.documentElement.lang).toBe("hi");
        expect(i18n.t("nav:login")).toBe("लॉग इन");
        await i18n.changeLanguage("en");
        expect(document.documentElement.lang).toBe("en");
        expect(i18n.t("nav:login")).toBe("Log in");
    });

    it("interpolates without escaping", async () => {
        await i18n.changeLanguage("en");
        expect(
            i18n.t("errors:accountLocked.body", { time: "14:59" })
        ).toContain("14:59");
    });

    it("falls back to English for namespaces that have no Hindi copy yet", async () => {
        await i18n.changeLanguage("hi");
        expect(
            i18n.t("landing:missing.key", { defaultValue: "fallback" })
        ).toBe("fallback");
        await i18n.changeLanguage("en");
    });
});
