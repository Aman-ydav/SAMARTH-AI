import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

export const newId = () => String(new mongoose.Types.ObjectId());

/** The acting user as `authenticate` would attach it: `{ id, role, orgId }`. */
export const makeActor = (overrides = {}) => ({
    id: newId(),
    role: "trainer",
    orgId: newId(),
    ...overrides,
});

/** Valid attributes for a `ready` public learning video record; pass overrides for other shapes. */
export const makeMediaAttrs = (overrides = {}) => {
    const kind = overrides.kind ?? "learning-content";
    return {
        orgId: newId(),
        ownerId: newId(),
        publicId: `samarth-ai/test/${kind}/${randomBytes(8).toString("hex")}`,
        resourceType: "video",
        kind,
        deliveryType: "public",
        status: "ready",
        format: "mp4",
        bytes: 2048,
        version: 1700000001,
        declaredBytes: 2048,
        declaredFormat: "mp4",
        ...overrides,
    };
};

/** A `pending` record as `POST /media/signatures` would leave it. */
export const makePendingAttrs = (overrides = {}) =>
    makeMediaAttrs({
        status: "pending",
        format: undefined,
        bytes: undefined,
        version: undefined,
        ...overrides,
    });

/** What Cloudinary's API returns for an asset (snake_case, as the SDK would). */
export const makeCloudinaryAsset = (record, overrides = {}) => ({
    public_id: record.publicId,
    resource_type: record.resourceType,
    type: record.deliveryType === "authenticated" ? "authenticated" : "upload",
    format: "mp4",
    bytes: 2048,
    width: 1280,
    height: 720,
    duration: 12.5,
    secure_url: "https://media.example.test/asset",
    version: 1700000002,
    ...overrides,
});
