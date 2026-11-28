import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_CURRICULUM_ITEMS = 30;

const courseSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true, maxlength: 64 },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        provider: {
            type: String,
            required: true,
            enum: ["iGOT Karmayogi", "NSSTA TPAC", "MoSPI Portal"],
            default: "iGOT Karmayogi",
        },
        domain: { type: String, required: true, trim: true, maxlength: 80 },
        competencyId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Competency",
        },
        targetLevel: { type: Number, required: true, min: 1, max: 5 },
        durationHours: { type: Number, required: true, min: 1 },
        rating: { type: Number, min: 1, max: 5, default: 4.5 },
        url: { type: String, required: true, trim: true, maxlength: 500 },
        thumbnail: { type: String, trim: true, maxlength: 500 },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        curriculum: {
            type: [{ type: String, trim: true, maxlength: 200 }],
            validate: {
                validator: (items) => items.length <= MAX_CURRICULUM_ITEMS,
                message: "A course lists at most 30 curriculum items.",
            },
        },
    },
    { timestamps: true, collection: "courses" }
);

// serves: the catalogue filtered by competency
courseSchema.index({ competencyId: 1 }, { name: "courses_competencyId" });
courseSchema.plugin(toJsonPlugin);

export const Course = mongoose.model("Course", courseSchema);
