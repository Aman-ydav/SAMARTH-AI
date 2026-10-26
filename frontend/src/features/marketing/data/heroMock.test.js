import { describe, expect, it } from "vitest";
import {
    MAX_LEVEL,
    MOCK_COMPETENCIES,
    MOCK_PATH,
    rankedGaps,
} from "@/features/marketing/data/heroMock";

describe("heroMock fixtures", () => {
    it("ranks gaps by size and drops met competencies", () => {
        const gaps = rankedGaps();
        expect(gaps.map((gap) => gap.id)).toEqual(["privacy", "ml", "python"]);
        expect(gaps.every((gap) => gap.gap >= 0.5)).toBe(true);
    });

    it("treats a gap under 0.5 as met", () => {
        const result = rankedGaps([{ id: "x", current: 3.6, required: 4 }]);
        expect(result).toEqual([]);
    });

    it("keeps levels inside the 0 to 5 scale and the path in the fixtures", () => {
        for (const item of MOCK_COMPETENCIES) {
            expect(item.current).toBeLessThanOrEqual(MAX_LEVEL);
            expect(item.required).toBeLessThanOrEqual(MAX_LEVEL);
        }
        expect(MOCK_PATH).toHaveLength(3);
    });
});
