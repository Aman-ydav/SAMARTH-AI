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
