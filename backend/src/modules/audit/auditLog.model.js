import mongoose from "mongoose";
import { AUDIT_ACTION_LIST } from "#constants/auditActions.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const objectId = mongoose.Schema.Types.ObjectId;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

export const AUDIT_GENESIS_HASH = "0".repeat(64);
export const AUDIT_META_MAX_BYTES = 4096;

const required = (code) => [true, code];

const auditLogSchema = new mongoose.Schema(
    {
        seq: {
            type: Number,
            required: required("SEQ_REQUIRED"),
            min: 1,
            validate: Number.isInteger,
            immutable: true,
        },
        at: { type: Date, required: required("AT_REQUIRED"), immutable: true },
        // No actor for system events and for sign-in attempts of unknown accounts.
        actorId: { type: objectId, immutable: true },
        orgId: {
            type: objectId,
            required: required("ORG_REQUIRED"),
            immutable: true,
        },
        action: {
            type: String,
            required: required("ACTION_REQUIRED"),
            enum: AUDIT_ACTION_LIST,
            immutable: true,
        },
        entityType: {
            type: String,
            required: required("ENTITY_TYPE_REQUIRED"),
            trim: true,
            maxlength: 40,
            immutable: true,
        },
        entityId: { type: objectId, immutable: true },
        // Mixed on purpose (DB-05 exception): event-specific details. audit.service caps it at 4 KB and refuses
        // passwords, tokens and raw emails, so only hashes and flags land here.
        meta: { type: mongoose.Schema.Types.Mixed, immutable: true },
        prevHash: {
            type: String,
            required: required("PREV_HASH_REQUIRED"),
            trim: true,
            lowercase: true,
            maxlength: 64,
            match: [HASH_PATTERN, "HASH_INVALID"],
            immutable: true,
        },
        hash: {
            type: String,
            required: required("HASH_REQUIRED"),
            trim: true,
            lowercase: true,
            maxlength: 64,
            match: [HASH_PATTERN, "HASH_INVALID"],
            immutable: true,
        },
    },
    // Append-only: `createdAt` only. Nothing ever updates a row.
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: "auditLogs",
    }
);

const appendOnly = async function appendOnly() {
    throw new Error("AUDIT_LOG_APPEND_ONLY");
};
const QUERY_WRITES = [
    "updateOne",
    "updateMany",
    "replaceOne",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "deleteMany",
];
auditLogSchema.pre(QUERY_WRITES, appendOnly);
auditLogSchema.pre("deleteOne", { document: true, query: true }, appendOnly);
auditLogSchema.pre("save", async function blockResave() {
    if (!this.isNew) throw new Error("AUDIT_LOG_APPEND_ONLY");
});

// serves: chain append (previous row by seq) and verification, which walks the chain in order
auditLogSchema.index({ seq: 1 }, { name: "auditLogs_seq_uq", unique: true });
auditLogSchema.index({ hash: 1 }, { name: "auditLogs_hash_uq", unique: true });
// serves: "what did this user do" in the admin audit search
auditLogSchema.index({ actorId: 1, at: -1 }, { name: "auditLogs_actorId_at" });
// serves: the org-wide audit search
auditLogSchema.index({ orgId: 1, at: -1 }, { name: "auditLogs_orgId_at" });
// serves: the history of one entity (for example one user)
auditLogSchema.index(
    { entityType: 1, entityId: 1, at: -1 },
    { name: "auditLogs_entityType_entityId_at" }
);

auditLogSchema.plugin(toJsonPlugin);

export const AuditLog =
    mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditLogSchema);
