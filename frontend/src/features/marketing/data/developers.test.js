import { describe, expect, it } from "vitest";
import { MEDIA_MANIFEST } from "@/assets/mediaManifest";
import {
    DEVELOPERS,
    getInitials,
    localizedText,
} from "@/features/marketing/data/developers";
import { safeExternalUrl } from "@/lib/safeUrl";

describe("developers data", () => {
    it("has exactly six entries with unique ids and the fields the owner fills", () => {
        expect(DEVELOPERS).toHaveLength(6);
        expect(new Set(DEVELOPERS.map((d) => d.id)).size).toBe(6);
        for (const developer of DEVELOPERS) {
            expect(Object.keys(developer).sort()).toEqual(
                [
                    "github",
                    "id",
                    "linkedin",
                    "name",
                    "note",
                    "placeholder",
                    "role",
                    "slot",
                ].sort()
            );
            expect(developer.name.trim().length).toBeGreaterThan(0);
            expect(typeof developer.placeholder).toBe("boolean");
        }
    });

    it("ships clearly marked placeholders named Developer 1 to Developer 6 and no real names", () => {
        DEVELOPERS.forEach((developer, index) => {
            expect(developer.placeholder).toBe(true);
            expect(developer.name).toBe(`Developer ${index + 1}`);
        });
    });

    it("has no profile links until the owner fills them, and any filled link is a safe https URL", () => {
        for (const developer of DEVELOPERS) {
            for (const value of [developer.github, developer.linkedin]) {
                if (value) expect(safeExternalUrl(value)).toMatch(/^https:/);
            }
            expect(developer.github).toBe("");
            expect(developer.linkedin).toBe("");
        }
    });

    it("points each avatar at an existing about.team manifest slot", () => {
        DEVELOPERS.forEach((developer, index) => {
            expect(developer.slot).toBe(`about.team.m${index + 1}`);
            expect(MEDIA_MANIFEST[developer.slot]).toBeDefined();
            expect(MEDIA_MANIFEST[developer.slot].width).toBe(480);
            expect(MEDIA_MANIFEST[developer.slot].height).toBe(480);
        });
    });

    it("gives every entry a role and note in English and Hindi", () => {
        for (const developer of DEVELOPERS) {
            for (const field of [developer.role, developer.note]) {
                expect(localizedText(field, "en").length).toBeGreaterThan(0);
                expect(localizedText(field, "hi").length).toBeGreaterThan(0);
            }
            expect(localizedText(developer.role, "hi")).not.toBe(
                localizedText(developer.role, "en")
            );
        }
    });
});

describe("localizedText", () => {
    it("accepts a plain string for both languages", () => {
        expect(localizedText("Same", "hi")).toBe("Same");
    });
    it("falls back to English, then to an empty string", () => {
        expect(localizedText({ en: "Only English" }, "hi")).toBe(
            "Only English"
        );
        expect(localizedText({}, "en")).toBe("");
        expect(localizedText(null, "en")).toBe("");
        expect(localizedText(undefined, "hi")).toBe("");
    });
});

describe("getInitials", () => {
    it("takes the first letter of up to two words", () => {
        expect(getInitials("Developer 1")).toBe("D1");
        expect(getInitials("asha rao verma")).toBe("AR");
        expect(getInitials("  Single ")).toBe("S");
    });
    it("keeps a whole Devanagari letter and survives bad input", () => {
        expect(getInitials("आशा राव")).toBe("आर");
        expect(getInitials("")).toBe("");
        expect(getInitials(null)).toBe("");
    });
});
