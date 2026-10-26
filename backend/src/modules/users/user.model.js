import mongoose from "mongoose";
import {
    AUTH_PROVIDER_LIST,
    AUTH_PROVIDERS,
    LOCALE_LIST,
    LOCALES,
    USER_STATUS_LIST,
    USER_STATUSES,
} from "#constants/statuses.js";
import { ROLE_LIST, ROLES } from "#constants/roles.js";
import { softDeletePlugin } from "#db/softDeletePlugin.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";
import { normalizeEmail } from "#utils/strings.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requiredCode = (code) => [true, code];
const maxItems = (limit, code) => ({
    validator: (items) => !items || items.length <= limit,
    message: code,
});

// Embedded copy of the confirmed `media` record (rule 10); the media module writes it, `publicId` is mandatory when present.
const avatarSchema = new mongoose.Schema(
    {
        publicId: {
            type: String,
            required: requiredCode("AVATAR_PUBLIC_ID_REQUIRED"),
            trim: true,
            maxlength: 255,
        },
        url: { type: String, trim: true, maxlength: 500 },
        version: { type: Number, min: 0, validate: Number.isInteger },
        bytes: {
            type: Number,
            min: 0,
            max: 104_857_600,
            validate: Number.isInteger,
        },
        format: { type: String, trim: true, lowercase: true, maxlength: 10 },
        width: { type: Number, min: 0, validate: Number.isInteger },
        height: { type: Number, min: 0, validate: Number.isInteger },
    },
    // Embedded value object: it changes only together with the user document, so it keeps no timestamps of its own.
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const userSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            required: requiredCode("ORG_REQUIRED"),
            immutable: true,
        },
        email: {
            type: String,
            required: requiredCode("EMAIL_REQUIRED"),
            set: normalizeEmail,
            trim: true,
            lowercase: true,
            maxlength: 254,
            match: [EMAIL_PATTERN, "EMAIL_INVALID"],
        },
        emailVerified: { type: Boolean, default: false },
        emailVerifiedAt: { type: Date, default: null },
        passwordHash: {
            type: String,
            trim: true,
            maxlength: 100,
            select: false,
        },
        passwordHistory: {
            type: [{ type: String, trim: true, maxlength: 100 }],
            default: [],
            select: false,
            validate: maxItems(3, "PASSWORD_HISTORY_TOO_LONG"),
        },
        passwordChangedAt: { type: Date },
        authProviders: {
            type: [{ type: String, enum: AUTH_PROVIDER_LIST }],
            default: [AUTH_PROVIDERS.LOCAL],
            validate: maxItems(3, "AUTH_PROVIDERS_TOO_LONG"),
        },
        googleSub: { type: String, trim: true, maxlength: 64 },
        name: {
            type: String,
            required: requiredCode("NAME_REQUIRED"),
            trim: true,
            minlength: 1,
            maxlength: 100,
        },
        role: { type: String, enum: ROLE_LIST, default: ROLES.LEARNER },
        status: {
            type: String,
            enum: USER_STATUS_LIST,
            default: USER_STATUSES.PENDING_VERIFICATION,
        },
        tokenVersion: {
            type: Number,
            default: 0,
            min: 0,
            validate: Number.isInteger,
        },
        failedLoginCount: {
            type: Number,
            default: 0,
            min: 0,
            validate: Number.isInteger,
        },
        lockoutCount: {
            type: Number,
            default: 0,
            min: 0,
            validate: Number.isInteger,
        },
        lockUntil: { type: Date, default: null },
        lastLoginAt: { type: Date, default: null },
        mustChangePassword: { type: Boolean, default: false },
        locale: { type: String, enum: LOCALE_LIST, default: LOCALES.EN },
        timezone: {
            type: String,
            default: "Asia/Kolkata",
            trim: true,
            maxlength: 64,
        },
        avatar: { type: avatarSchema, default: undefined },
        termsAcceptedAt: { type: Date },
        policyVersion: { type: String, trim: true, maxlength: 20 },
        deactivatedAt: { type: Date, default: null },
        deletionScheduledAt: { type: Date, default: null },
        knownDeviceHashes: {
            type: [{ type: String, trim: true, minlength: 64, maxlength: 64 }],
            default: [],
            select: false,
            validate: maxItems(20, "KNOWN_DEVICES_TOO_LONG"),
        },
    },
    { timestamps: true, collection: "users" }
);

userSchema.plugin(softDeletePlugin);

// Derived and cheap (DB-14): a lock is active only while `lockUntil` is in the future.
userSchema.virtual("isLocked").get(function isLocked() {
    return Boolean(this.lockUntil && this.lockUntil > new Date());
});

// serves: login, register and forgot-password lookups by normalised email; the duplicate-key error is the "exists" path
userSchema.index({ email: 1 }, { name: "users_email_uq", unique: true });
// serves: Google sign-in by `sub`; partial because most users have no Google account (DB-22)
userSchema.index(
    { googleSub: 1 },
    {
        name: "users_googleSub_uq",
        unique: true,
        partialFilterExpression: { googleSub: { $type: "string" } },
    }
);
// serves: admin user lists and the last-admin count (role + status within an org)
userSchema.index(
    { orgId: 1, role: 1, status: 1 },
    { name: "users_orgId_role_status" }
);
// serves: the deletion job that anonymises accounts whose grace period ended
userSchema.index(
    { status: 1, deletionScheduledAt: 1 },
    { name: "users_status_deletionScheduledAt" }
);

userSchema.plugin(toJsonPlugin);

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
