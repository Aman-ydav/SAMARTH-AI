import { MEDIA_STATUSES } from "#constants/statuses.js";
import { deleteAsset } from "#integrations/cloudinary/cloudinary.adapter.js";
import { addMs } from "#utils/dates.js";
import { logger } from "#utils/logger.js";
import { ne } from "#utils/mongoOps.js";
import { PURGED_RETENTION_MS } from "./media.constants.js";
import { Media } from "./media.model.js";

/**
 * Soft-deletes the first matching live record (status `deleted`, `deletedAt` set) and stops its TTL clock so the row
 * survives until Cloudinary confirms the purge. Returns the updated document, or null when nothing matched (MEDIA-11).
 */
export function softDeleteMedia(filter, now = new Date()) {
    return Media.findOneAndUpdate(
        {
            ...filter,
            status: ne(MEDIA_STATUSES.DELETED),
        },
        {
            $set: { status: MEDIA_STATUSES.DELETED, deletedAt: now },
            $unset: { expiresAt: "" },
        },
        { returnDocument: "after" }
    ).setOptions({ withDeleted: true });
}

/** Records that the Cloudinary asset is gone and starts the audit-retention TTL clock. Legacy assets have no row. */
export async function markPurged(record, now = new Date()) {
    if (!record._id) return;
    await Media.updateOne(
        { _id: record._id },
        {
            $set: {
                purgedAt: now,
                expiresAt: addMs(now, PURGED_RETENTION_MS),
            },
        }
    ).setOptions({ withDeleted: true });
}

/**
 * Deletes the Cloudinary asset by stored `publicId` and `resourceType` (MEDIA-09). A failure is logged and left for the
 * orphan sweep; it never fails the user request (MEDIA-11). Returns true when the asset is gone.
 */
export async function purgeAsset(record, now = new Date()) {
    try {
        await deleteAsset({
            publicId: record.publicId,
            resourceType: record.resourceType,
            deliveryType: record.deliveryType,
        });
    } catch (error) {
        logger.warn(
            {
                err: error,
                mediaId: String(record._id ?? ""),
                event: "media.purge",
            },
            "cloudinary delete failed, the orphan sweep will retry"
        );
        return false;
    }
    await markPurged(record, now);
    return true;
}

/** Soft-deletes a record and then purges its asset; the DB update comes first (MEDIA-11). Returns the purge result. */
export async function retireMedia(record, now = new Date()) {
    await softDeleteMedia({ _id: record._id }, now);
    return purgeAsset(record, now);
}
