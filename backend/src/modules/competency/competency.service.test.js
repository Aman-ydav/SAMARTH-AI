import { describe, it, expect } from "vitest";
import {
    getCompetencies,
    getRoleProfiles,
    getRoleProfileById,
} from "./competency.service.js";

describe("Competency Service", () => {
    it("loads standard statistical, technical, and governance competencies", async () => {
        const competencies = await getCompetencies();
        expect(competencies.length).toBeGreaterThan(5);

        const s01 = competencies.find((c) => c.id === "S01");
        expect(s01).toBeDefined();
        expect(s01.domain).toBe("Statistical");
        expect(s01.levels).toHaveLength(6);
    });

    it("loads official job roles including statistical officer", async () => {
        const roles = await getRoleProfiles();
        expect(roles.length).toBeGreaterThanOrEqual(4);

        const statOfficer = roles.find((r) => r.id === "statistical_officer");
        expect(statOfficer).toBeDefined();
        expect(statOfficer.requiredCompetencies.length).toBeGreaterThan(0);
    });

    it("throws 404 for unknown role profile", async () => {
        await expect(getRoleProfileById("non_existent_role")).rejects.toThrow();
    });
});
