import mongoose from "mongoose";
import {
    MEDIA_DELIVERY_TYPE_LIST,
    MEDIA_KIND_LIST,
    MEDIA_RESOURCE_TYPE_LIST,
} from "#constants/mediaKinds.js";
import { MEDIA_STATUS_LIST, MEDIA_STATUSES } from "#constants/statuses.js";
import { softDeletePlugin } from "#db/softDeletePlugin.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_BYTES = 104_857_600;
const integer = {
    validator: Number.isInteger,
    message: "MEDIA_NOT_AN_INTEGER",
};
const count = (max) => ({
    type: Number,
    min: 0,
    max,
    validate: integer,
    default: undefined,
});

const mediaSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "MEDIA_ORG_REQUIRED"],
            immutable: true,
        },
        // The uploader (rule 05 register); every ownership check starts from this field.
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "MEDIA_OWNER_REQUIRED"],
            immutable: true,
        },
        // Full Cloudinary public id including the folder; server-chosen, never the client filename (MEDIA-04a).
        publicId: {
            type: String,
            required: [true, "MEDIA_PUBLIC_ID_REQUIRED"],
            trim: true,
            maxlength: 255,
            immutable: true,
        },
        resourceType: {
            type: String,
            required: [true, "MEDIA_RESOURCE_TYPE_REQUIRED"],
            enum: MEDIA_RESOURCE_TYPE_LIST,
            immutable: true,
        },
        kind: {
            type: String,
            required: [true, "MEDIA_KIND_REQUIRED"],
            enum: MEDIA_KIND_LIST,
            immutable: true,
        },
        deliveryType: {
            type: String,
            required: [true, "MEDIA_DELIVERY_TYPE_REQUIRED"],
            enum: MEDIA_DELIVERY_TYPE_LIST,
            immutable: true,
        },
        format: { type: String, trim: true, lowercase: true, maxlength: 10 },
        // Confirmed from Cloudinary, never from the client (MEDIA-07).
        bytes: count(MAX_BYTES),
        width: count(100_000),
        height: count(100_000),
        duration: { type: Number, min: 0, max: 86_400, default: undefined },
        secureUrl: {
            type: String,
            trim: true,
            maxlength: 500,
            match: /^https:\/\//,
        },
        // Cache-busting and webhook idempotency (MEDIA-13).
        version: count(Number.MAX_SAFE_INTEGER),
        status: {
            type: String,
            required: [true, "MEDIA_STATUS_REQUIRED"],
            enum: MEDIA_STATUS_LIST,
            default: MEDIA_STATUSES.PENDING,
        },
        // What the signature request promised. `confirm` compares the real asset with these (tampered metadata).
        declaredBytes: count(MAX_BYTES),
        declaredFormat: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 10,
        },
        confirmedAt: { type: Date, default: null },
        // Set once the Cloudinary asset is really gone; `status: deleted` with `purgedAt: null` is retried by the sweep.
        purgedAt: { type: Date, default: null },
        // TTL clock: pending records and purged records only; confirmed assets never expire.
        expiresAt: { type: Date, default: undefined },
    },
    { timestamps: true, collection: "media" }
);

mediaSchema.plugin(softDeletePlugin);
mediaSchema.plugin(toJsonPlugin);

// serves: publicId lookups from confirm, webhook and avatar replacement; uniqueness of server-chosen ids
mediaSchema.index({ publicId: 1 }, { name: "media_publicId_uq", unique: true });
// serves: "my uploads" and ownership checks scoped by org and owner
mediaSchema.index(
    { orgId: 1, ownerId: 1, kind: 1, status: 1 },
    { name: "media_orgId_ownerId_kind_status" }
);
// serves: orphan sweep (stale pending, expired temp assets)
mediaSchema.index(
    { status: 1, createdAt: 1 },
    { name: "media_status_createdAt" }
);
// serves: orphan sweep retry of deleted records whose Cloudinary asset is still there
mediaSchema.index(
    { status: 1, purgedAt: 1, deletedAt: 1 },
    { name: "media_status_purgedAt_deletedAt" }
);
// serves: TTL removal of stale pending and old purged records (TTL runs about 60 s late, DB-24)
mediaSchema.index(
    { expiresAt: 1 },
    {
        name: "media_expiresAt_ttl",
        expireAfterSeconds: 0,
        partialFilterExpression: { expiresAt: { $type: "date" } },
    }
);

export const Media = mongoose.model("Media", mediaSchema);
