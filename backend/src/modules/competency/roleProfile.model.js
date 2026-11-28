import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_REQUIRED_COMPETENCIES = 60;

const requiredCompetencySchema = new mongoose.Schema(
    {
        competencyId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Competency",
        },
        minimumLevel: { type: Number, required: true, min: 1, max: 5 },
        weight: { type: Number, default: 1.0, min: 0.1, max: 5.0 },
    },
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const roleProfileSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true, maxlength: 64 }, // e.g. "statistical_officer"
        title: { type: String, required: true, trim: true, maxlength: 120 },
        department: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        requiredCompetencies: {
            type: [requiredCompetencySchema],
            validate: {
                validator: (list) => list.length <= MAX_REQUIRED_COMPETENCIES,
                message: "A role profile requires at most 60 competencies.",
            },
        },
    },
    { timestamps: true, collection: "roleProfiles" }
);

roleProfileSchema.plugin(toJsonPlugin);

export const RoleProfile = mongoose.model("RoleProfile", roleProfileSchema);
