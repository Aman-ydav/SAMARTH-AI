import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const enrolmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        courseId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Course",
        },
        status: {
            type: String,
            enum: ["enrolled", "in_progress", "completed"],
            default: "enrolled",
        },
        progressPercent: { type: Number, min: 0, max: 100, default: 0 },
        enrolledAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
    },
    { timestamps: true, collection: "enrolments" }
);

// One enrolment per learner and course; it also serves "my enrolments" by its userId prefix.
enrolmentSchema.index(
    { userId: 1, courseId: 1 },
    { unique: true, name: "enrolments_userId_courseId_uq" }
);
enrolmentSchema.plugin(toJsonPlugin);

export const Enrolment = mongoose.model("Enrolment", enrolmentSchema);
