import { describe, it, expect } from "vitest";
import { getCourses, getCourseById } from "./learning.service.js";

describe("Learning Service", () => {
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
});
