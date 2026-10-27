import { describe, expect, it } from "vitest";
import {
    MAX_LEVEL,
    MOCK_COMPETENCIES,
    MOCK_CONFIDENCE,
    MOCK_FEED,
    MOCK_NAV,
    MOCK_PATH,
    MOCK_SESSIONS,
    TOUR_STEPS,
    gapRows,
    levelOf,
    priorityOf,
    rankedGaps,
    readiness,
} from "@/features/marketing/data/heroMock";

describe("heroMock fixtures", () => {
    it("has about eight competencies in the 0 to 5 scale with unique ids", () => {
        expect(MOCK_COMPETENCIES).toHaveLength(8);
        expect(new Set(MOCK_COMPETENCIES.map((item) => item.id)).size).toBe(8);
        for (const item of MOCK_COMPETENCIES) {
            expect(item.current).toBeGreaterThanOrEqual(0);
            expect(item.current).toBeLessThanOrEqual(MAX_LEVEL);
            expect(item.required).toBeLessThanOrEqual(MAX_LEVEL);
            expect(MOCK_CONFIDENCE[item.id]).toMatch(/^(high|medium|low)$/);
        }
    });

    it("ranks gaps by priority score (gap times importance), then gap, then order", () => {
        expect(rankedGaps().map((gap) => gap.id)).toEqual([
            "privacy",
            "ml",
            "surveyDesign",
            "python",
            "sdmx",
        ]);
        expect(rankedGaps().every((gap) => gap.gap >= 0.5)).toBe(true);
    });

    it("treats a gap under 0.5 as met and keeps met competencies out of the ranking", () => {
        expect(rankedGaps([{ id: "x", current: 3.6, required: 4 }])).toEqual(
            []
        );
        const ids = rankedGaps().map((gap) => gap.id);
        expect(ids).not.toContain("sampling");
        expect(ids).not.toContain("leadership");
    });

    it("derives priority labels from gap times importance", () => {
        expect(priorityOf(2, 3)).toBe("high");
        expect(priorityOf(1, 3)).toBe("medium");
        expect(priorityOf(1, 2)).toBe("low");
        expect(priorityOf(0, 3)).toBe("low");
    });

    it("applies the quiz evidence to one level only", () => {
        const changed = MOCK_COMPETENCIES.filter(
            (item) => levelOf(item, true) !== levelOf(item, false)
        );
        expect(changed.map((item) => item.id)).toEqual(["privacy"]);
        expect(levelOf(changed[0], false)).toBe(2);
        expect(levelOf(changed[0], true)).toBe(3);
    });

    it("keeps the gap row order fixed through the evidence step but updates the values", () => {
        const before = gapRows(false);
        const after = gapRows(true);
        expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
        expect(before[0]).toMatchObject({
            id: "privacy",
            gap: 2,
            priority: "high",
        });
        expect(after[0]).toMatchObject({
            id: "privacy",
            gap: 1,
            priority: "medium",
        });
    });

    it("computes readiness from the levels, higher after the evidence", () => {
        expect(readiness()).toBe(75);
        expect(readiness(MOCK_COMPETENCIES, true)).toBe(79);
        expect(readiness([])).toBe(0);
    });

    it("recommends a path whose items each close a known competency", () => {
        expect(MOCK_PATH).toHaveLength(4);
        const ids = MOCK_COMPETENCIES.map((item) => item.id);
        for (const item of MOCK_PATH) {
            expect(ids).toContain(item.closes);
            expect(["igot", "nssta"]).toContain(item.source);
            expect(item.progress).toBeLessThanOrEqual(item.after);
        }
    });

    it("tells the story in order: profile, gaps, path, evidence", () => {
        expect(TOUR_STEPS.map((step) => step.id)).toEqual([
            "profile",
            "gaps",
            "path",
            "evidence",
        ]);
        expect(TOUR_STEPS.filter((step) => step.evidence)).toHaveLength(1);
        expect(TOUR_STEPS.at(-1).evidence).toBe(true);
        expect(TOUR_STEPS[0].required).toBe(false);
        for (const step of TOUR_STEPS) {
            expect(step.shift).toBeGreaterThanOrEqual(0);
            expect(step.shift).toBeLessThanOrEqual(1);
            expect(step.focus.length).toBeGreaterThan(0);
        }
    });

    it("has navigation, activity and session fixtures", () => {
        expect(MOCK_NAV.filter((item) => item.active)).toHaveLength(1);
        expect(MOCK_FEED.length).toBeGreaterThanOrEqual(3);
        expect(MOCK_SESSIONS).toHaveLength(3);
    });
});
