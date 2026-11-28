import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_LEVELS = 6;

const levelDescriptorSchema = new mongoose.Schema(
    {
        level: { type: Number, required: true, min: 0, max: 5 },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
    },
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const competencySchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true, maxlength: 64 }, // e.g., "S01", "T01", "D01"
        name: { type: String, required: true, trim: true, maxlength: 120 },
        domain: {
            type: String,
            required: true,
            enum: [
                "Statistical",
                "Technical",
                "Digital Governance",
                "Leadership & Management",
            ],
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        levels: {
            type: [levelDescriptorSchema],
            validate: {
                validator: (levels) => levels.length <= MAX_LEVELS,
                message: "A competency has at most six levels.",
            },
        },
    },
    { timestamps: true, collection: "competencies" }
);

competencySchema.plugin(toJsonPlugin);

export const Competency = mongoose.model("Competency", competencySchema);
