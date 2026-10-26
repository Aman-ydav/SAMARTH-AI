import { ERROR_CODES } from "#constants/errorCodes.js";
import { MEDIA_DELIVERY_TYPES } from "#constants/mediaKinds.js";
import { MEDIA_STATUSES } from "#constants/statuses.js";
import {
    createSignedUpload,
    fetchAsset,
} from "#integrations/cloudinary/cloudinary.adapter.js";
import { buildFolder } from "#integrations/cloudinary/folders.mapper.js";
import {
    allowedFormatsFor,
    FILE_TYPES,
    MEDIA_RULES,
} from "#integrations/cloudinary/mediaPolicy.mapper.js";
import { ApiError } from "#utils/apiError.js";
import { addMs } from "#utils/dates.js";
import { toObjectId } from "#utils/mongo.js";
import {
    PENDING_TTL_MS,
    SIGNATURE_ROLES_BY_KIND,
    SIGNATURE_TTL_MS,
} from "./media.constants.js";
import { Media } from "./media.model.js";
import { retireMedia } from "./mediaCleanup.service.js";

/** Explicit allowlisted DTO (BE-47, doc 08 section 4); never the raw document. */
export const toPublicMedia = (doc) => ({
    id: String(doc._id ?? doc.id),
    kind: doc.kind,
    publicId: doc.publicId,
    resourceType: doc.resourceType,
    deliveryType: doc.deliveryType,
    format: doc.format ?? null,
    bytes: doc.bytes ?? null,
    width: doc.width ?? null,
    height: doc.height ?? null,
    duration: doc.duration ?? null,
    version: doc.version ?? null,
    status: doc.status,
});

const compact = (values) =>
    Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined)
    );
const notFound = () => ApiError.notFound(ERROR_CODES.MEDIA_NOT_FOUND);
const typeNotAllowed = (message) =>
    ApiError.badRequest(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED, { message });

function assertMayUpload(role, kind) {
    if (!SIGNATURE_ROLES_BY_KIND[kind]?.includes(role))
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
}

/**
 * Issues a signed direct-upload request (MEDIA-07). Order: role (403), policy (400/413), then a `pending` record so
 * `confirm` can later compare the real asset with what was promised. Only server-decided values are signed (MEDIA-07a).
 */
export async function requestMediaSignature({ user, input, now = new Date() }) {
    const { kind, resourceType, contentType, bytes, filename } = input;
    assertMayUpload(user.role, kind);
    const signed = createSignedUpload({
        kind,
        mime: contentType,
        bytes,
        ownerId: String(user.id),
        now: now.getTime(),
    });
    const fileType = FILE_TYPES[contentType];
    if (signed.resourceType !== resourceType)
        throw typeNotAllowed("The resource type does not match the file type");
    const extension = String(filename ?? "")
        .split(".")
        .pop()
        .toLowerCase();
    if (filename && !fileType.extensions.includes(extension))
        throw typeNotAllowed("The file extension does not match its type");

    const record = await Media.create({
        orgId: user.orgId,
        ownerId: user.id,
        publicId: signed.fullPublicId,
        resourceType: signed.resourceType,
        kind,
        deliveryType:
            signed.type === "authenticated"
                ? MEDIA_DELIVERY_TYPES.AUTHENTICATED
                : MEDIA_DELIVERY_TYPES.PUBLIC,
        status: MEDIA_STATUSES.PENDING,
        declaredBytes: bytes,
        declaredFormat: fileType.format,
        expiresAt: addMs(now, PENDING_TTL_MS),
    });
    return {
        mediaId: String(record._id),
        cloudName: signed.cloudName,
        apiKey: signed.apiKey,
        timestamp: signed.timestamp,
        signature: signed.signature,
        folder: signed.folder,
        publicId: signed.publicId,
        allowedFormats: signed.allowedFormats,
        resourceType: signed.resourceType,
        type: signed.type,
        maxBytes: signed.maxBytes,
        expiresAt: addMs(now, SIGNATURE_TTL_MS).toISOString(),
        uploadParams: {
            api_key: signed.apiKey,
            timestamp: signed.timestamp,
            signature: signed.signature,
            folder: signed.folder,
            public_id: signed.publicId,
            allowed_formats: signed.allowedFormats,
            type: signed.type,
        },
    };
}

/** Compares the real Cloudinary asset with the pending record; every mismatch is a typed error (MEDIA-07, 07d). */
function assertAssetMatches(record, asset) {
    const rule = MEDIA_RULES[record.kind].find(
        (candidate) =>
            candidate.resourceType === record.resourceType &&
            candidate.delivery === record.deliveryType
    );
    if (
        asset.publicId !== record.publicId ||
        !asset.publicId.startsWith(`${buildFolder(record.kind)}/`)
    )
        throw ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
            message: "The uploaded asset is not in the expected location",
        });
    if (
        !rule ||
        asset.resourceType !== record.resourceType ||
        asset.deliveryType !== record.deliveryType
    )
        throw typeNotAllowed("The uploaded asset type is not allowed");
    if (!Number.isInteger(asset.bytes) || asset.bytes <= 0)
        throw ApiError.badRequest(ERROR_CODES.UPLOAD_INVALID, {
            message: "The uploaded asset is empty",
        });
    if (asset.bytes > rule.maxBytes)
        throw ApiError.fromCode(ERROR_CODES.MEDIA_TOO_LARGE);
    // Raw assets carry no `format` from Cloudinary: for them the signed allowed_formats list is the guard.
    const format = asset.format?.toLowerCase();
    if (format === undefined) {
        if (record.resourceType !== "raw")
            throw typeNotAllowed("The uploaded asset format is unknown");
        return;
    }
    if (
        !allowedFormatsFor(rule).includes(format) ||
        (record.declaredFormat && record.declaredFormat !== format)
    )
        throw typeNotAllowed("The uploaded asset format is not allowed");
}

/**
 * Confirms a direct upload (MEDIA-07): fetches the real asset from Cloudinary and never trusts client metadata.
 * Rejected assets are deleted and their record retired. A repeated confirm of a `ready` record returns it unchanged.
 */
export async function confirmMediaUpload({
    user,
    mediaId,
    publicId,
    now = new Date(),
}) {
    const scope = { orgId: user.orgId, ownerId: user.id };
    const record = await Media.findOne(
        mediaId
            ? { _id: toObjectId(mediaId, "mediaId"), ...scope }
            : { publicId, ...scope }
    );
    if (!record) throw notFound();
    assertMayUpload(user.role, record.kind);
    if (record.status === MEDIA_STATUSES.READY) return toPublicMedia(record);

    const asset = await fetchAsset({
        publicId: record.publicId,
        resourceType: record.resourceType,
        deliveryType: record.deliveryType,
    });
    try {
        assertAssetMatches(record, asset);
    } catch (error) {
        await retireMedia(record, now);
        throw error;
    }
    const updated = await Media.findOneAndUpdate(
        { _id: record._id, status: MEDIA_STATUSES.PENDING },
        {
            $set: compact({
                status: MEDIA_STATUSES.READY,
                confirmedAt: now,
                format: asset.format ?? record.declaredFormat,
                bytes: asset.bytes,
                width: asset.width,
                height: asset.height,
                duration: asset.duration,
                secureUrl: asset.secureUrl,
                version: asset.version,
            }),
            $unset: { expiresAt: "" },
        },
        { returnDocument: "after", runValidators: true }
    );
    if (updated) return toPublicMedia(updated);
    // A concurrent confirm won the race: answer with its result instead of failing (EDGE-30).
    const current = await Media.findById(record._id);
    if (current?.status === MEDIA_STATUSES.READY) return toPublicMedia(current);
    throw notFound();
}
