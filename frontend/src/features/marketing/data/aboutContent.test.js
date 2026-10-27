import { describe, expect, it } from "vitest";
import {
    ABOUT_PLACEHOLDERS,
    BUILD_CHAPTERS,
    LADDER_LEVELS,
    PRODUCT_FACTS,
    ROADMAP_PHASES,
    STATUS_BADGE_VARIANT,
    STORY_STOPS,
    TECH_STACK,
} from "@/features/marketing/data/aboutContent";
import enAbout from "@/i18n/locales/en/about.json";
import hiAbout from "@/i18n/locales/hi/about.json";
import enErrors from "@/i18n/locales/en/errors.json";
import hiErrors from "@/i18n/locales/hi/errors.json";

function flatten(value, prefix = "") {
    if (value === null || typeof value !== "object") return [[prefix, value]];
    return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
    );
}

const variables = (text) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();

describe("About content data", () => {
    it("holds only figures that exist in the product docs", () => {
        expect(PRODUCT_FACTS).toEqual([
            { id: "domains", value: 4 },
            { id: "competencies", value: 43 },
            { id: "levels", value: 6 },
            { id: "roles", value: 10 },
        ]);
        expect(LADDER_LEVELS).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("flags every unknown fact as a bracketed placeholder", () => {
        for (const value of Object.values(ABOUT_PLACEHOLDERS)) {
            expect(value).toMatch(/^\[[A-Z_]+: placeholder\]$/);
        }
    });

    it("defines five story stops and five build chapters with unique ids", () => {
        expect(STORY_STOPS).toHaveLength(5);
        expect(BUILD_CHAPTERS).toHaveLength(5);
        expect(new Set(STORY_STOPS.map((stop) => stop.id)).size).toBe(5);
        expect(new Set(BUILD_CHAPTERS.map((chapter) => chapter.id)).size).toBe(
            5
        );
        expect(BUILD_CHAPTERS.map((chapter) => chapter.id)).toEqual([
            "idea",
            "framework",
            "backend",
            "interface",
            "next",
        ]);
    });

    it("gives every chapter a known status and a badge variant, and calls unfinished work unfinished", () => {
        for (const { status } of BUILD_CHAPTERS) {
            expect(Object.keys(STATUS_BADGE_VARIANT)).toContain(status);
        }
        expect(
            BUILD_CHAPTERS.find((chapter) => chapter.id === "next").status
        ).toBe("planned");
        expect(
            BUILD_CHAPTERS.some((chapter) => chapter.status !== "done")
        ).toBe(true);
    });

    it("gives every roadmap phase a known status and a unique id", () => {
        expect(ROADMAP_PHASES).toHaveLength(6);
        expect(new Set(ROADMAP_PHASES.map((phase) => phase.id)).size).toBe(6);
        for (const { status } of ROADMAP_PHASES) {
            expect(["done", "inProgress", "planned"]).toContain(status);
        }
    });

    it("lists each technology once", () => {
        expect(new Set(TECH_STACK).size).toBe(TECH_STACK.length);
    });
});

describe("About copy in en and hi", () => {
    it("has the lists the page expects, with the same lengths in both languages", () => {
        for (const copy of [enAbout, hiAbout]) {
            expect(copy.principles.items).toHaveLength(6);
            expect(copy.ladder.levels).toHaveLength(LADDER_LEVELS.length);
            expect(copy.roadmap.phases).toHaveLength(ROADMAP_PHASES.length);
            expect(copy.story.stops).toHaveLength(STORY_STOPS.length);
            expect(copy.how.chapters).toHaveLength(BUILD_CHAPTERS.length);
            for (const chapter of copy.how.chapters)
                expect(chapter.points).toHaveLength(3);
            expect(copy.facts.items).toHaveLength(PRODUCT_FACTS.length);
            expect(copy.story.facts).toHaveLength(3);
        }
    });

    it("has no Hindi key that English lacks, no missing Hindi key, and equal variables", () => {
        const en = new Map(flatten(enAbout));
        const hi = new Map(flatten(hiAbout));
        for (const [key, value] of hi) {
            expect(en.has(key), `orphan hi key ${key}`).toBe(true);
            expect(variables(value), key).toEqual(variables(en.get(key)));
        }
        for (const key of en.keys()) {
            expect(hi.has(key), `hi is missing ${key}`).toBe(true);
        }
    });

    it("names the problem statement SIH26101 and MoSPI", () => {
        const values = enAbout.story.facts.map((fact) => fact.value);
        expect(values).toContain("SIH26101");
        expect(values).toContain("MoSPI");
    });
});

describe("errors.pages copy (state and start pages)", () => {
    it("exists in English and Hindi with identical key sets and variables", () => {
        const en = new Map(flatten(enErrors.pages));
        const hi = new Map(flatten(hiErrors.pages));
        expect([...hi.keys()].sort()).toEqual([...en.keys()].sort());
        for (const [key, value] of hi) {
            expect(value.length).toBeGreaterThan(0);
            expect(variables(value), key).toEqual(variables(en.get(key)));
        }
    });
});
