import mongoose from "mongoose";
import { INVITABLE_ROLES } from "#constants/roles.js";
import {
    AUTH_TOKEN_TYPE_LIST,
    EMAIL_CHANGE_KINDS,
} from "#constants/tokenTypes.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";
import { normalizeEmail } from "#utils/strings.js";

const objectId = mongoose.Schema.Types.ObjectId;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TTL_GRACE_SECONDS = 7 * 24 * 60 * 60;

const emailField = {
    type: String,
    set: normalizeEmail,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: [EMAIL_PATTERN, "EMAIL_INVALID"],
};

// Typed sub-document instead of Mixed (DB-05). `kind`, `oldEmail`, `newEmail` are used by emailChange only (R8).
const metaSchema = new mongoose.Schema(
    {
        kind: { type: String, enum: Object.values(EMAIL_CHANGE_KINDS) },
        role: { type: String, enum: INVITABLE_ROLES },
        orgId: { type: objectId },
        oldEmail: emailField,
        newEmail: emailField,
    },
    // Embedded value object: written once with its token, so it keeps no timestamps of its own.
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const authTokenSchema = new mongoose.Schema(
    {
        // Not mandatory: invite and registration tokens exist before a user does (R36).
        orgId: { type: objectId, immutable: true },
        userId: { type: objectId, immutable: true },
        email: {
            ...emailField,
            required: [true, "EMAIL_REQUIRED"],
        },
        type: {
            type: String,
            required: [true, "TYPE_REQUIRED"],
            enum: AUTH_TOKEN_TYPE_LIST,
            immutable: true,
        },
        tokenHash: {
            type: String,
            required: [true, "TOKEN_HASH_REQUIRED"],
            trim: true,
            lowercase: true,
            minlength: 64,
            maxlength: 64,
            immutable: true,
            select: false,
        },
        // Per type: verify 24 h, reset 30 min, invite 7 d, email change 24 h. Superseding a token sets this to now.
        expiresAt: { type: Date, required: [true, "EXPIRES_AT_REQUIRED"] },
        usedAt: { type: Date, default: null },
        createdIpHash: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 64,
        },
        createdUserAgent: { type: String, trim: true, maxlength: 200 },
        meta: { type: metaSchema, default: undefined },
    },
    { timestamps: true, collection: "authTokens" }
);

// serves: superseding older tokens, resend caps and cooldown (count by user, type, recency)
authTokenSchema.index(
    { userId: 1, type: 1, usedAt: 1 },
    { name: "authTokens_userId_type_usedAt" }
);
// serves: consuming or checking a token by the SHA-256 of the emailed value; single use
authTokenSchema.index(
    { tokenHash: 1 },
    { name: "authTokens_tokenHash_uq", unique: true }
);
// serves: retention. Rows live 7 days after expiry; code still checks expiresAt > now (DB-24)
authTokenSchema.index(
    { expiresAt: 1 },
    { name: "authTokens_expiresAt_ttl", expireAfterSeconds: TTL_GRACE_SECONDS }
);

authTokenSchema.plugin(toJsonPlugin);

export const AuthToken =
    mongoose.models.AuthToken ?? mongoose.model("AuthToken", authTokenSchema);
