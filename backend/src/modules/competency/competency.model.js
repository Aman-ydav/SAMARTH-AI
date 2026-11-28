import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const levelDescriptorSchema = new mongoose.Schema(
    {
        level: { type: Number, required: true, min: 0, max: 5 },
        name: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const competencySchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true }, // e.g., "S01", "T01", "D01"
        name: { type: String, required: true, trim: true },
        domain: {
            type: String,
            required: true,
            enum: ["Statistical", "Technical", "Digital Governance", "Leadership & Management"],
            trim: true,
        },
        description: { type: String, required: true, trim: true },
        levels: [levelDescriptorSchema],
    },
    { timestamps: true }
);

competencySchema.plugin(toJsonPlugin);

const requiredCompetencySchema = new mongoose.Schema(
    {
        competencyId: { type: String, required: true, ref: "Competency" },
        minimumLevel: { type: Number, required: true, min: 1, max: 5 },
        weight: { type: Number, default: 1.0, min: 0.1, max: 5.0 },
    },
    { _id: false }
);

const roleProfileSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true }, // e.g. "statistical_officer"
        title: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        requiredCompetencies: [requiredCompetencySchema],
    },
    { timestamps: true }
);

roleProfileSchema.plugin(toJsonPlugin);

const evidenceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["self_assessment", "quiz_attempt", "course_completion", "trainer_endorsement"],
            required: true,
        },
        sourceId: { type: String, trim: true },
        score: { type: Number, min: 0, max: 100 },
        notes: { type: String, trim: true },
        earnedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const userCompetencySchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        competencyId: { type: String, required: true, ref: "Competency", index: true },
        currentLevel: { type: Number, required: true, min: 0, max: 5, default: 0 },
        confidenceScore: { type: Number, min: 0, max: 1, default: 0.5 },
        evidence: [evidenceSchema],
        lastAssessedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

userCompetencySchema.index({ userId: 1, competencyId: 1 }, { unique: true });
userCompetencySchema.plugin(toJsonPlugin);

export const Competency = mongoose.model("Competency", competencySchema);
export const RoleProfile = mongoose.model("RoleProfile", roleProfileSchema);
export const UserCompetency = mongoose.model("UserCompetency", userCompetencySchema);
