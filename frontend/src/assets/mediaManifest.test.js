import { describe, expect, it } from "vitest";
import {
    MEDIA_MANIFEST,
    MEDIA_SLOT_IDS,
    getMediaSlot,
    listMediaTodo,
} from "@/assets/mediaManifest";
import en from "@/i18n/locales/en/landing.json";
import hi from "@/i18n/locales/hi/landing.json";

/* Every slot id listed in docs/23 section 3 "Media slots". */
const DOC_23_SLOTS = [
    "landing.hero.dashboard",
    "landing.tour.assessment",
    "landing.tour.mapping",
    "landing.tour.recs",
    "landing.tour.dashboards",
    "landing.tour.language",
    "landing.roles.learner",
    "landing.roles.trainer",
    "landing.roles.admin",
    "landing.roles.superadmin",
    "landing.og.default",
    "about.team.m1",
    "about.team.m2",
    "about.team.m3",
    "about.team.m4",
    "about.team.m5",
    "about.team.m6",
];

const lookup = (messages, key) =>
    key.split(".").reduce((node, part) => node?.[part], messages);

describe("mediaManifest", () => {
    it.each(DOC_23_SLOTS)("declares the docs/23 slot %s", (slot) => {
        expect(MEDIA_SLOT_IDS).toContain(slot);
    });

    it("sizes slots as docs/23 lists them", () => {
        expect(getMediaSlot("landing.hero.dashboard")).toMatchObject({
            width: 1600,
            height: 1000,
        });
        expect(getMediaSlot("landing.tour.assessment")).toMatchObject({
            width: 1600,
            height: 900,
        });
        expect(getMediaSlot("landing.roles.admin")).toMatchObject({
            width: 800,
            height: 600,
        });
        expect(getMediaSlot("landing.og.default")).toMatchObject({
            width: 1200,
            height: 630,
        });
        expect(getMediaSlot("about.team.m3")).toMatchObject({
            width: 480,
            height: 480,
        });
    });

    it("starts every slot as a placeholder with no publicId (MEDIA-31)", () => {
        for (const slot of MEDIA_SLOT_IDS) {
            expect(MEDIA_MANIFEST[slot]).toMatchObject({
                publicId: null,
                placeholder: true,
                kind: "image",
            });
        }
    });

    it("keeps alt text in i18n, present in English and Hindi", () => {
        for (const slot of MEDIA_SLOT_IDS) {
            const { altKey } = MEDIA_MANIFEST[slot];
            const [namespace, key] = altKey.split(":");
            expect(namespace).toBe("landing");
            expect(lookup(en, key), `${altKey} in en`).toBeTruthy();
            expect(lookup(hi, key), `${altKey} in hi`).toBeTruthy();
        }
    });

    it("proposes a unique marketing public id per slot", () => {
        const ids = MEDIA_SLOT_IDS.map(
            (slot) => MEDIA_MANIFEST[slot].proposedPublicId
        );
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids)
            expect(id).toMatch(/^samarth-ai\/prod\/marketing\/[a-z0-9-]+$/);
    });

    it("lists every placeholder as the team TODO", () => {
        expect(listMediaTodo()).toHaveLength(MEDIA_SLOT_IDS.length);
        expect(listMediaTodo()[0]).toHaveProperty("proposedPublicId");
    });

    it("returns null for an unknown slot", () => {
        expect(getMediaSlot("nope.slot")).toBeNull();
    });
});
