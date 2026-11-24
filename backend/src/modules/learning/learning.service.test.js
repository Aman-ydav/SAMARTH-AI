import { describe, it, expect } from "vitest";
import {
    getCourses,
    getCourseById,
    getRecommendationsForUser,
    getLearningPath,
} from "./learning.service.js";

describe("Learning Service & Pathway Builder", () => {
    it("fetches courses with domain and search filters", async () => {
        const all = await getCourses();
        expect(all.length).toBeGreaterThan(0);

        const statOnly = await getCourses({ domain: "Statistical" });
        expect(statOnly.every((c) => c.domain === "Statistical")).toBe(true);

        const search = await getCourses({ search: "Sampling" });
        expect(search.length).toBeGreaterThan(0);
    });

    it("retrieves a single course by id", async () => {
        const course = await getCourseById("igot_stat_01");
        expect(course.id).toBe("igot_stat_01");
        expect(course.provider).toBe("iGOT Karmayogi");
        expect(course.curriculum.length).toBeGreaterThan(0);
    });

    it("generates AI-ranked recommendations tailored to user skill gaps", async () => {
        const fakeUserId = "671aa0000000000000000001";
        const recs = await getRecommendationsForUser(fakeUserId, "statistical_officer");

        expect(recs.recommendations.length).toBeGreaterThan(0);
        const topRec = recs.recommendations[0];
        expect(topRec.aiReason).toBeDefined();
        expect(topRec.priorityScore).toBeGreaterThan(0);
    });

    it("constructs a 3-phase structured learning pathway", async () => {
        const fakeUserId = "671aa0000000000000000001";
        const pathData = await getLearningPath(fakeUserId, "statistical_officer");

        expect(pathData.stages).toHaveLength(3);
        expect(pathData.stages[0].name).toContain("Phase 1");
        expect(pathData.stages[1].name).toContain("Phase 2");
        expect(pathData.stages[2].name).toContain("Phase 3");
        expect(pathData.totalHours).toBeGreaterThan(0);
    });
});
