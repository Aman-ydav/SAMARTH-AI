import { DEFAULT_TARGET_ROLE } from "./competency.constants.js";
import {
    getRoleProfileById,
    getUserCompetencies,
} from "./competency.service.js";

/**
 * Calculates skill gaps against target job role requirements:
 * Gap Delta = max(0, requiredLevel - currentLevel)
 * Severity:
 *   - critical: delta >= 2
 *   - moderate: delta == 1
 *   - met: delta <= 0
 * Role Readiness Score = (sum of min(currentLevel, requiredLevel) * weight) / (sum of requiredLevel * weight) * 100
 */
export async function calculateGapAnalysis(
    userId,
    targetRoleId = DEFAULT_TARGET_ROLE
) {
    const role = await getRoleProfileById(targetRoleId);
    const userCompetencyList = await getUserCompetencies(userId);
    const userLevelMap = new Map();
    const competencyDetailMap = new Map();

    for (const c of userCompetencyList) {
        userLevelMap.set(c.competencyId, c.currentLevel);
        competencyDetailMap.set(c.competencyId, c);
    }

    let totalWeightedRequired = 0;
    let totalWeightedAttained = 0;

    const domainTotals = {
        Statistical: { required: 0, attained: 0 },
        Technical: { required: 0, attained: 0 },
        "Digital Governance": { required: 0, attained: 0 },
        "Leadership & Management": { required: 0, attained: 0 },
    };

    const gaps = [];

    for (const req of role.requiredCompetencies) {
        const comp = competencyDetailMap.get(req.competencyId);
        const name = comp?.name || req.competencyId;
        const domain = comp?.domain || "Statistical";
        const currentLevel = userLevelMap.get(req.competencyId) || 0;
        const requiredLevel = req.minimumLevel;
        const weight = req.weight || 1.0;

        const delta = Math.max(0, requiredLevel - currentLevel);
        const attainedLevel = Math.min(currentLevel, requiredLevel);

        totalWeightedRequired += requiredLevel * weight;
        totalWeightedAttained += attainedLevel * weight;

        if (!domainTotals[domain]) {
            domainTotals[domain] = { required: 0, attained: 0 };
        }
        domainTotals[domain].required += requiredLevel * weight;
        domainTotals[domain].attained += attainedLevel * weight;

        let severity = "met";
        if (delta >= 2) severity = "critical";
        else if (delta === 1) severity = "moderate";

        gaps.push({
            competencyId: req.competencyId,
            name,
            domain,
            currentLevel,
            requiredLevel,
            gapDelta: delta,
            severity,
            weight,
            isMet: delta === 0,
        });
    }

    // Sort gaps: critical first, then moderate, then met; secondary sort by weight descending
    gaps.sort((a, b) => {
        const order = { critical: 0, moderate: 1, met: 2 };
        if (order[a.severity] !== order[b.severity]) {
            return order[a.severity] - order[b.severity];
        }
        return b.weight - a.weight;
    });

    const roleReadinessScore =
        totalWeightedRequired > 0
            ? Math.round((totalWeightedAttained / totalWeightedRequired) * 100)
            : 100;

    const domainBreakdown = {};
    for (const [dom, stats] of Object.entries(domainTotals)) {
        if (stats.required > 0) {
            domainBreakdown[dom] = {
                required: stats.required,
                attained: stats.attained,
                readinessScore: Math.round(
                    (stats.attained / stats.required) * 100
                ),
            };
        }
    }

    const criticalGapsCount = gaps.filter(
        (g) => g.severity === "critical"
    ).length;
    const moderateGapsCount = gaps.filter(
        (g) => g.severity === "moderate"
    ).length;
    const metCount = gaps.filter((g) => g.severity === "met").length;

    return {
        targetRole: {
            id: role.id,
            title: role.title,
            department: role.department,
            description: role.description,
        },
        readinessScore: roleReadinessScore,
        summary: {
            totalRequired: role.requiredCompetencies.length,
            criticalGapsCount,
            moderateGapsCount,
            metCount,
        },
        domainBreakdown,
        gaps,
    };
}
