import mongoose from "mongoose";
import { softDeletePlugin } from "#db/softDeletePlugin.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const requiredCode = (code) => [true, code];
const MAX_DOMAINS = 20;

const settingsSchema = new mongoose.Schema(
    {
        allowSelfRegistration: { type: Boolean, default: true },
        allowedEmailDomains: {
            type: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
            default: [],
            validate: {
                validator: (domains) =>
                    Array.isArray(domains) && domains.length <= MAX_DOMAINS,
                message: "ORGANISATION_DOMAINS_TOO_LONG",
            },
        },
        requireEmailVerification: { type: Boolean, default: true },
        allowGoogleLogin: { type: Boolean, default: true },
    },
    { _id: false }
);

const organisationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: requiredCode("ORGANISATION_NAME_REQUIRED"),
            trim: true,
            minlength: 2,
            maxlength: 120,
        },
        nameKey: {
            type: String,
            required: requiredCode("ORGANISATION_NAME_KEY_REQUIRED"),
            trim: true,
            lowercase: true,
            maxlength: 120,
        },
        code: {
            type: String,
            required: requiredCode("ORGANISATION_CODE_REQUIRED"),
            trim: true,
            lowercase: true,
            minlength: 2,
            maxlength: 20,
            match: [/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "ORGANISATION_CODE_INVALID"],
        },
        settings: { type: settingsSchema, default: () => ({}) },
    },
    {
        timestamps: true,
        collection: "organisations",
        optimisticConcurrency: true,
    }
);

organisationSchema.plugin(softDeletePlugin);
organisationSchema.plugin(toJsonPlugin);

// serves: active and soft-deleted organization uniqueness (DB-23)
organisationSchema.index(
    { nameKey: 1, deletedAt: 1 },
    { name: "organisations_nameKey_deletedAt_uq", unique: true }
);
organisationSchema.index(
    { code: 1, deletedAt: 1 },
    { name: "organisations_code_deletedAt_uq", unique: true }
);

export const Organisation =
    mongoose.models.Organisation ??
    mongoose.model("Organisation", organisationSchema);
