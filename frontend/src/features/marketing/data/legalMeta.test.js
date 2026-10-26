import { describe, expect, it } from "vitest";
import {
    LEGAL_LAST_UPDATED,
    LEGAL_PLACEHOLDERS,
    LEGAL_VERSION,
    PRIVACY_SECTIONS,
    TERMS_SECTIONS,
} from "@/features/marketing/data/legalMeta";
import enLegal from "@/i18n/locales/en/legal.json";
import hiLegal from "@/i18n/locales/hi/legal.json";

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function flatten(value, prefix = "") {
    if (value === null || typeof value !== "object") return [[prefix, value]];
    return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
    );
}

describe("legal metadata", () => {
    it("has a dated draft version and ISO last-updated date", () => {
        expect(LEGAL_VERSION).toBe("2026-10-26-draft-0.1");
        expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("keeps every placeholder visibly bracketed so it cannot pass as real data", () => {
        for (const value of Object.values(LEGAL_PLACEHOLDERS)) {
            expect(value).toMatch(/^\[[A-Z_]+: placeholder\]$/);
        }
    });

    it.each([
        ["privacy", PRIVACY_SECTIONS],
        ["terms", TERMS_SECTIONS],
    ])(
        "%s sections have unique kebab-case ids and copy in en and hi",
        (doc, sections) => {
            const ids = sections.map((section) => section.id);
            expect(new Set(ids).size).toBe(ids.length);
            for (const { id, key } of sections) {
                expect(id).toMatch(KEBAB);
                const en = enLegal[doc].sections[key];
                const hi = hiLegal[doc].sections[key];
                expect(en, `en ${doc}.${key}`).toBeDefined();
                expect(en.title).toBeTruthy();
                expect(
                    (en.paragraphs?.length ?? 0) + (en.items?.length ?? 0)
                ).toBeGreaterThan(0);
                expect(hi?.title, `hi title ${doc}.${key}`).toBeTruthy();
            }
            expect(Object.keys(enLegal[doc].sections)).toHaveLength(
                sections.length
            );
        }
    );

    it("has no Hindi key that English lacks and matching array lengths", () => {
        const en = new Map(flatten(enLegal));
        for (const [key, value] of flatten(hiLegal)) {
            expect(en.has(key), `orphan hi key ${key}`).toBe(true);
            expect(typeof value).toBe("string");
            expect(value.length).toBeGreaterThan(0);
        }
    });

    it("keeps interpolation variables identical between en and hi", () => {
        const en = new Map(flatten(enLegal));
        for (const [key, value] of flatten(hiLegal)) {
            const vars = (text) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
            expect(vars(value), key).toEqual(vars(en.get(key)));
        }
    });

    it("lists the six cookies of rule 04 in both languages", () => {
        const names = [
            "sai_access",
            "sai_refresh",
            "sai_csrf",
            "sai-theme",
            "sai-lang",
            "sai-sidebar",
        ];
        expect(enLegal.cookies.rows.map((row) => row.name)).toEqual(names);
        expect(hiLegal.cookies.rows.map((row) => row.name)).toEqual(names);
    });
});
