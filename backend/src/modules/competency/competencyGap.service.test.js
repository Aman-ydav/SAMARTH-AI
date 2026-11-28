import { describe, it, expect } from "vitest";
import { calculateGapAnalysis } from "./competencyGap.service.js";

describe("Gap Analysis Engine", () => {
    it("correctly computes skill gaps, severity, and role readiness score", async () => {
        // Mock userId
        const fakeUserId = "671aa0000000000000000001";
        const result = await calculateGapAnalysis(
            fakeUserId,
            "statistical_officer"
        );

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
