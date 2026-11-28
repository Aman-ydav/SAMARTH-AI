import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { COMPETENCY_LIMITS } from "./competency.constants.js";
import { Competency } from "./competency.model.js";
import { RoleProfile } from "./roleProfile.model.js";
import {
    MAX_EVIDENCE_ENTRIES,
    UserCompetency,
} from "./userCompetency.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_DIR = path.resolve(__dirname, "../../seed/data");

const isDbConnected = () => mongoose.connection.readyState === 1;

async function loadFallbackJson(filename) {
    try {
        const filePath = path.join(SEED_DATA_DIR, filename);
        const data = await readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getCompetencies() {
    let list = [];
    if (isDbConnected()) {
        try {
            list = await Competency.find()
                .sort({ domain: 1, _id: 1 })
                .limit(COMPETENCY_LIMITS.frameworkMax)
                .lean();
        } catch {
            list = [];
        }
    }
    if (!list || list.length === 0) {
        list = await loadFallbackJson("competencies.json");
    }
    return list.map((item) => ({
        id: item._id || item.id,
        name: item.name,
        domain: item.domain,
        description: item.description,
        levels: item.levels,
    }));
}

export async function getRoleProfiles() {
    let roles = [];
    if (isDbConnected()) {
        try {
            roles = await RoleProfile.find()
                .sort({ title: 1 })
                .limit(COMPETENCY_LIMITS.listMax)
                .lean();
        } catch {
            roles = [];
        }
    }
    if (!roles || roles.length === 0) {
        roles = await loadFallbackJson("roleProfiles.json");
    }
    return roles.map((r) => ({
        id: r._id || r.id,
        title: r.title,
        department: r.department,
        description: r.description,
        requiredCompetencies: r.requiredCompetencies,
    }));
}

export async function getRoleProfileById(roleId) {
    let role = null;
    if (isDbConnected()) {
        try {
            role = await RoleProfile.findById(roleId).lean();
        } catch {
            role = null;
        }
    }
    if (!role) {
        const fallbacks = await loadFallbackJson("roleProfiles.json");
        role = fallbacks.find((r) => (r._id || r.id) === roleId);
    }
    if (!role) {
        throw ApiError.notFound(ERROR_CODES.ROLE_NOT_FOUND);
    }
    return {
        id: role._id || role.id,
        title: role.title,
        department: role.department,
        description: role.description,
        requiredCompetencies: role.requiredCompetencies,
    };
}

export async function getUserCompetencies(userId) {
    let userRecords = [];
    if (isDbConnected()) {
        try {
            userRecords = await UserCompetency.find({ userId })
                .limit(COMPETENCY_LIMITS.frameworkMax)
                .lean();
        } catch {
            userRecords = [];
        }
    }
    const map = new Map();
    for (const record of userRecords) {
        map.set(record.competencyId, record);
    }

    const allCompetencies = await getCompetencies();
    return allCompetencies.map((comp) => {
        const userRec = map.get(comp.id);
        return {
            competencyId: comp.id,
            name: comp.name,
            domain: comp.domain,
            description: comp.description,
            currentLevel: userRec ? userRec.currentLevel : 0,
            confidenceScore: userRec ? userRec.confidenceScore : 0.5,
            evidence: userRec?.evidence || [],
            lastAssessedAt: userRec?.lastAssessedAt || null,
        };
    });
}

const invalidRatings = (message) =>
    ApiError.badRequest(ERROR_CODES.INVALID_RATINGS, {
        errors: [{ field: "ratings", message }],
    });

/** Only competencies of the framework, each rated once: a stray id would otherwise create an orphan row for the learner. */
async function checkRatings(ratings) {
    const known = new Set((await getCompetencies()).map((c) => c.id));
    const seen = new Set();
    for (const { competencyId } of ratings) {
        if (!known.has(competencyId))
            throw invalidRatings("Unknown competency");
        if (seen.has(competencyId))
            throw invalidRatings("Each competency can be rated once");
        seen.add(competencyId);
    }
}

export async function saveSelfAssessment(userId, ratings) {
    await checkRatings(ratings);

    const now = new Date();
    await Promise.all(
        ratings.map(({ competencyId, level }) =>
            UserCompetency.findOneAndUpdate(
                { userId, competencyId },
                {
                    $set: { currentLevel: level, lastAssessedAt: now },
                    $push: {
                        evidence: {
                            $each: [
                                {
                                    type: "self_assessment",
                                    score: level * 20,
                                    notes: `Self-rated as Level ${level}`,
                                    earnedAt: now,
                                },
                            ],
                            // DB-16: the newest entries are kept, so the trail cannot grow without limit.
                            $slice: -MAX_EVIDENCE_ENTRIES,
                        },
                    },
                },
                { upsert: true, returnDocument: "after" }
            )
        )
    );
    return getUserCompetencies(userId);
}

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
    targetRoleId = "statistical_officer"
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
