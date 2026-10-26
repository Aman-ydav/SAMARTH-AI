import mongoose from "mongoose";
import { SESSION_REVOKED_REASON_LIST } from "#constants/statuses.js";
import { SESSION_TTL_GRACE_SECONDS } from "#constants/tokenTypes.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const objectId = mongoose.Schema.Types.ObjectId;
const HASH_LENGTH = 64;

const refreshSessionSchema = new mongoose.Schema(
    {
        orgId: {
            type: objectId,
            required: [true, "ORG_REQUIRED"],
            immutable: true,
        },
        userId: {
            type: objectId,
            required: [true, "USER_REQUIRED"],
            immutable: true,
        },
        // One family per device login; rotation keeps it, so reuse of an old token can revoke every row of the family.
        familyId: {
            type: String,
            required: [true, "FAMILY_REQUIRED"],
            trim: true,
            maxlength: HASH_LENGTH,
            immutable: true,
        },
        tokenHash: {
            type: String,
            required: [true, "TOKEN_HASH_REQUIRED"],
            trim: true,
            lowercase: true,
            minlength: HASH_LENGTH,
            maxlength: HASH_LENGTH,
            immutable: true,
            select: false,
        },
        // min(sliding window, absoluteExpiresAt); still checked in code because TTL deletion runs about a minute late.
        expiresAt: { type: Date, required: [true, "EXPIRES_AT_REQUIRED"] },
        // The family's hard cap (30 d, remember-me 90 d), copied to every rotated row (R6): the first row alone is not
        // enough because the TTL index can remove it while a remember-me family is still alive.
        absoluteExpiresAt: {
            type: Date,
            required: [true, "ABSOLUTE_EXPIRES_AT_REQUIRED"],
            immutable: true,
        },
        revokedAt: { type: Date, default: null },
        revokedReason: { type: String, enum: SESSION_REVOKED_REASON_LIST },
        replacedBy: { type: objectId, ref: "RefreshSession", default: null },
        ipHash: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: HASH_LENGTH,
        },
        userAgent: { type: String, trim: true, maxlength: 200 },
        userAgentHash: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: HASH_LENGTH,
        },
        lastUsedAt: { type: Date },
        remember: { type: Boolean, default: false },
    },
    { timestamps: true, collection: "refreshSessions" }
);

// serves: active-session count and list per user, logout-all and the 10-session cap
refreshSessionSchema.index(
    { userId: 1, revokedAt: 1, expiresAt: 1 },
    { name: "refreshSessions_userId_revokedAt_expiresAt" }
);
// serves: reuse detection and logout, which revoke every row of a family; authenticate checks the family is active
refreshSessionSchema.index(
    { familyId: 1 },
    { name: "refreshSessions_familyId" }
);
// serves: refresh, which finds the row by the keyed hash of the cookie value
refreshSessionSchema.index(
    { tokenHash: 1 },
    { name: "refreshSessions_tokenHash_uq", unique: true }
);
// serves: retention. Rows live 30 days after expiry so reuse detection and audit still see them (R7)
refreshSessionSchema.index(
    { expiresAt: 1 },
    {
        name: "refreshSessions_expiresAt_ttl",
        expireAfterSeconds: SESSION_TTL_GRACE_SECONDS,
    }
);

refreshSessionSchema.plugin(toJsonPlugin);

export const RefreshSession =
    mongoose.models.RefreshSession ??
    mongoose.model("RefreshSession", refreshSessionSchema);
