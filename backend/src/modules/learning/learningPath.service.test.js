import { describe, it, expect } from "vitest";
import {
    getLearningPath,
    getRecommendationsForUser,
} from "./learningPath.service.js";

describe("Recommendations & Pathway Builder", () => {
    it("generates AI-ranked recommendations tailored to user skill gaps", async () => {
        const fakeUserId = "671aa0000000000000000001";
        const recs = await getRecommendationsForUser(
            fakeUserId,
            "statistical_officer"
        );

        expect(recs.recommendations.length).toBeGreaterThan(0);
        const topRec = recs.recommendations[0];
        expect(topRec.aiReason).toBeDefined();
        expect(topRec.priorityScore).toBeGreaterThan(0);
    });

    it("constructs a 3-phase structured learning pathway", async () => {
        const fakeUserId = "671aa0000000000000000001";
        const pathData = await getLearningPath(
            fakeUserId,
            "statistical_officer"
        );

        expect(pathData.stages).toHaveLength(3);
        expect(pathData.stages[0].name).toContain("Phase 1");
        expect(pathData.stages[1].name).toContain("Phase 2");
        expect(pathData.stages[2].name).toContain("Phase 3");
        expect(pathData.totalHours).toBeGreaterThan(0);
    });
});
