import { describe, it, expect } from "vitest";
import {
    getCompetencies,
    getRoleProfiles,
    getRoleProfileById,
    calculateGapAnalysis,
} from "./competency.service.js";

describe("Competency Service & Gap Analysis Engine", () => {
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

    it("correctly computes skill gaps, severity, and role readiness score", async () => {
        // Mock userId
        const fakeUserId = "671aa0000000000000000001";
        const result = await calculateGapAnalysis(fakeUserId, "statistical_officer");

        expect(result.targetRole.id).toBe("statistical_officer");
        expect(typeof result.readinessScore).toBe("number");
        expect(result.gaps.length).toBeGreaterThan(0);

        // Since user has 0 for all unassessed competencies, delta should be > 0
        const firstGap = result.gaps[0];
        expect(firstGap.gapDelta).toBeGreaterThanOrEqual(0);
        expect(["critical", "moderate", "met"]).toContain(firstGap.severity);
        expect(result.domainBreakdown).toBeDefined();
    });
});
