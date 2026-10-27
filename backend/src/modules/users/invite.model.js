import mongoose from "mongoose";
import { INVITABLE_ROLES } from "#constants/roles.js";
import { INVITE_STATUS_LIST, INVITE_STATUSES } from "#constants/statuses.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";
import { normalizeEmail } from "#utils/strings.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectId = mongoose.Schema.Types.ObjectId;

const inviteSchema = new mongoose.Schema(
    {
        orgId: {
            type: objectId,
            required: [true, "ORG_REQUIRED"],
            immutable: true,
        },
        email: {
            type: String,
            required: [true, "EMAIL_REQUIRED"],
            set: normalizeEmail,
            trim: true,
            lowercase: true,
            maxlength: 254,
            match: [EMAIL_PATTERN, "EMAIL_INVALID"],
        },
        role: {
            type: String,
            required: [true, "ROLE_REQUIRED"],
            enum: INVITABLE_ROLES,
        },
        departmentId: { type: objectId },
        invitedBy: {
            type: objectId,
            required: [true, "INVITED_BY_REQUIRED"],
            immutable: true,
        },
        status: {
            type: String,
            enum: INVITE_STATUS_LIST,
            default: INVITE_STATUSES.SENT,
        },
        tokenId: {
            type: objectId,
            ref: "AuthToken",
            required: [true, "TOKEN_REQUIRED"],
        },
        resentCount: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
            validate: Number.isInteger,
        },
        expiresAt: { type: Date, required: [true, "EXPIRES_AT_REQUIRED"] },
        acceptedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: "invites" }
);

// serves: "is there already an open invite for this address in this org"; history rows (accepted, revoked) stay (no TTL)
inviteSchema.index(
    { orgId: 1, email: 1 },
    {
        name: "invites_orgId_email_pf_uq",
        unique: true,
        partialFilterExpression: { status: INVITE_STATUSES.SENT },
    }
);
// serves: GET /admin/invites, newest first within an org, optionally by status
inviteSchema.index(
    { orgId: 1, status: 1, createdAt: -1 },
    { name: "invites_orgId_status_createdAt" }
);
// serves: accept-invite, which finds the invite by the consumed token's id
inviteSchema.index({ tokenId: 1 }, { name: "invites_tokenId" });

inviteSchema.plugin(toJsonPlugin);

export const Invite =
    mongoose.models.Invite ?? mongoose.model("Invite", inviteSchema);
