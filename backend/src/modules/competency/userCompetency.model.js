import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

/** DB-16: the evidence trail grows with every assessment, so each learner keeps their newest 50 entries per competency. */
export const MAX_EVIDENCE_ENTRIES = 50;

const evidenceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: [
                "self_assessment",
                "quiz_attempt",
                "course_completion",
                "trainer_endorsement",
            ],
            required: true,
        },
        sourceId: { type: String, trim: true, maxlength: 64 },
        score: { type: Number, min: 0, max: 100 },
        notes: { type: String, trim: true, maxlength: 300 },
        earnedAt: { type: Date, default: Date.now },
    },
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const userCompetencySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        competencyId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Competency",
        },
        currentLevel: {
            type: Number,
            required: true,
            min: 0,
            max: 5,
            default: 0,
        },
        confidenceScore: { type: Number, min: 0, max: 1, default: 0.5 },
        evidence: {
            type: [evidenceSchema],
            validate: {
                validator: (entries) => entries.length <= MAX_EVIDENCE_ENTRIES,
                message: "Evidence is capped at 50 entries.",
            },
        },
        lastAssessedAt: { type: Date, default: Date.now },
    },
    { timestamps: true, collection: "userCompetencies" }
);

// One row per learner and competency; it also serves "all my competencies" by its userId prefix.
userCompetencySchema.index(
    { userId: 1, competencyId: 1 },
    { unique: true, name: "userCompetencies_userId_competencyId_uq" }
);
userCompetencySchema.plugin(toJsonPlugin);

export const UserCompetency = mongoose.model(
    "UserCompetency",
    userCompetencySchema
);
