import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

// Named sequences. `_id` is the sequence name (for example "auditSeq"); `seq` is incremented atomically (DB-32).
const counterSchema = new mongoose.Schema(
    {
        _id: { type: String, trim: true, maxlength: 60 },
        seq: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    },
    { timestamps: true, collection: "counters" }
);

counterSchema.plugin(toJsonPlugin);

export const Counter =
    mongoose.models.Counter ?? mongoose.model("Counter", counterSchema);
