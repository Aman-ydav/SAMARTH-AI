import { describe, expect, it } from "vitest";
import {
    ACRONYM_CARDS,
    FRAMEWORK_DOMAINS,
    FRAMEWORK_FIGURES,
    HOW_STEP_IDS,
    ROLE_CARDS,
    TOUR_PANELS,
    TRUST_ITEMS,
} from "@/features/marketing/data/landingContent";
import { getMediaSlot } from "@/assets/mediaManifest";
import en from "@/i18n/locales/en/landing.json";
import hi from "@/i18n/locales/hi/landing.json";

const lookup = (messages, key) =>
    key.split(".").reduce((node, part) => node?.[part], messages);

const LANGUAGES = [
    ["en", en],
    ["hi", hi],
];

function flatten(node, prefix = "") {
    return Object.entries(node).flatMap(([key, value]) =>
        value && typeof value === "object"
            ? flatten(value, `${prefix}${key}.`)
            : [`${prefix}${key}`]
    );
}

describe("landing content structure", () => {
    it("lists the SAMARTH letters in order", () => {
        expect(ACRONYM_CARDS.map((card) => card.letter).join("")).toBe(
            "SAMARTH"
        );
    });

    it("marks planned and partly planned letters honestly", () => {
        const byId = Object.fromEntries(
            ACRONYM_CARDS.map((card) => [card.id, card.status])
        );
        expect(byId.t).toBe("planned");
        expect(byId.a1).toBe("partial");
        expect(byId.r).toBe("simulated");
        expect(byId.s).toBeNull();
    });

    it("uses only the figures that exist in the product docs", () => {
        const figures = Object.fromEntries(
            FRAMEWORK_FIGURES.map((f) => [f.id, f.value])
        );
        expect(figures).toEqual({
            domains: 4,
            competencies: 43,
            levels: 6,
            roles: 10,
        });
        expect(
            FRAMEWORK_DOMAINS.reduce((sum, domain) => sum + domain.count, 0)
        ).toBe(43);
    });

    it("keeps four steps, five tour panels and four roles", () => {
        expect(HOW_STEP_IDS).toHaveLength(4);
        expect(TOUR_PANELS).toHaveLength(5);
        expect(ROLE_CARDS).toHaveLength(4);
    });

    it("points every media use at a manifest slot", () => {
        for (const item of [...TOUR_PANELS, ...ROLE_CARDS]) {
            expect(getMediaSlot(item.slot), item.slot).not.toBeNull();
        }
    });

    it.each(LANGUAGES)(
        "has every key the structure references in %s",
        (_name, messages) => {
            const keys = [
                ...ACRONYM_CARDS.flatMap((c) => [
                    `acronym.cards.${c.id}.word`,
                    `acronym.cards.${c.id}.text`,
                    ...(c.status ? [`acronym.status.${c.status}`] : []),
                ]),
                ...HOW_STEP_IDS.flatMap((id) => [
                    `how.steps.${id}.title`,
                    `how.steps.${id}.body`,
                ]),
                ...TOUR_PANELS.flatMap((p) => [
                    `tour.panels.${p.id}.headline`,
                    `tour.panels.${p.id}.sub`,
                    `tour.panels.${p.id}.bullets`,
                    `tour.panels.${p.id}.note`,
                ]),
                ...ROLE_CARDS.flatMap((r) => [
                    `roles.items.${r.id}.title`,
                    `roles.items.${r.id}.sub`,
                    `roles.items.${r.id}.bullets`,
                ]),
                ...FRAMEWORK_FIGURES.map((f) => `framework.figures.${f.id}`),
                ...FRAMEWORK_DOMAINS.map((d) => `framework.domains.${d.id}`),
                ...TRUST_ITEMS.flatMap((t) => [
                    `trust.items.${t.id}`,
                    ...(t.badge ? [`trust.badge.${t.badge}`] : []),
                ]),
            ];
            for (const key of keys)
                expect(lookup(messages, key), key).not.toBeUndefined();
        }
    );

    it("has identical key sets in English and Hindi", () => {
        expect(flatten(hi).sort()).toEqual(flatten(en).sort());
    });

    it("keeps list lengths equal in both languages", () => {
        for (const key of [
            "hero.tickerChips",
            "standards.chips",
            "faq.items",
            "problem.lines",
        ]) {
            expect(lookup(hi, key)).toHaveLength(lookup(en, key).length);
        }
        for (const panel of TOUR_PANELS) {
            const key = `tour.panels.${panel.id}.bullets`;
            expect(lookup(hi, key)).toHaveLength(lookup(en, key).length);
        }
    });

    it("keeps the problem statement within 60 words", () => {
        for (const [, messages] of LANGUAGES) {
            expect(
                messages.problem.statement.split(/\s+/).length
            ).toBeLessThanOrEqual(60);
        }
    });
});
