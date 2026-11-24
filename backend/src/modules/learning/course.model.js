import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const courseSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        provider: {
            type: String,
            required: true,
            enum: ["iGOT Karmayogi", "NSSTA TPAC", "MoSPI Portal"],
            default: "iGOT Karmayogi",
        },
        domain: { type: String, required: true, trim: true },
        competencyId: { type: String, required: true, ref: "Competency", index: true },
        targetLevel: { type: Number, required: true, min: 1, max: 5 },
        durationHours: { type: Number, required: true, min: 1 },
        rating: { type: Number, min: 1, max: 5, default: 4.5 },
        url: { type: String, required: true, trim: true },
        thumbnail: { type: String, trim: true },
        description: { type: String, required: true, trim: true },
        curriculum: [{ type: String, trim: true }],
    },
    { timestamps: true }
);

courseSchema.plugin(toJsonPlugin);

const enrolmentSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        courseId: { type: String, ref: "Course", required: true },
        status: {
            type: String,
            enum: ["enrolled", "in_progress", "completed"],
            default: "enrolled",
        },
        progressPercent: { type: Number, min: 0, max: 100, default: 0 },
        enrolledAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
    },
    { timestamps: true }
);

enrolmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrolmentSchema.plugin(toJsonPlugin);

export const Course = mongoose.model("Course", courseSchema);
export const Enrolment = mongoose.model("Enrolment", enrolmentSchema);
