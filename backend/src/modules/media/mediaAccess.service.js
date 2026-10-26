import { ERROR_CODES } from "#constants/errorCodes.js";
import { MEDIA_DELIVERY_TYPES, MEDIA_KINDS } from "#constants/mediaKinds.js";
import { MEDIA_STATUSES } from "#constants/statuses.js";
import { createAccessUrl } from "#integrations/cloudinary/cloudinary.adapter.js";
import { ApiError } from "#utils/apiError.js";
import { addMs } from "#utils/dates.js";
import { toObjectId } from "#utils/mongo.js";
import { ACCESS_URL_TTL_SECONDS, PRIVILEGED_ROLES } from "./media.constants.js";
import { Media } from "./media.model.js";
import { toPublicMedia } from "./media.service.js";
import { purgeAsset, softDeleteMedia } from "./mediaCleanup.service.js";

const isOwner = (record, user) => String(record.ownerId) === String(user.id);
const notFound = () => ApiError.notFound(ERROR_CODES.MEDIA_NOT_FOUND);

/** Loads a record the caller may see: owner, or admin/superadmin of the same org. Anything else is 404 (BE-42). */
async function findVisible(user, id, extra = {}) {
    const record = await Media.findOne({
        _id: toObjectId(id),
        orgId: user.orgId,
        ...extra,
    });
    const allowed =
        record &&
        (isOwner(record, user) || PRIVILEGED_ROLES.includes(user.role));
    if (!allowed) throw notFound();
    return record;
}

/** Short-lived signed download URL for an `authenticated` asset (MEDIA-08a). Public assets need no access URL. */
export async function getMediaAccessUrl({ user, id, now = new Date() }) {
    const record = await findVisible(user, id, {
        status: MEDIA_STATUSES.READY,
    });
    if (record.deliveryType !== MEDIA_DELIVERY_TYPES.AUTHENTICATED)
        throw ApiError.unprocessable(ERROR_CODES.UNPROCESSABLE, {
            message: "This asset is public and needs no access link",
        });
    return {
        mediaId: String(record._id),
        url: createAccessUrl({
            publicId: record.publicId,
            format: record.format ?? record.declaredFormat ?? "",
            resourceType: record.resourceType,
            ttlSeconds: ACCESS_URL_TTL_SECONDS,
            now: now.getTime(),
        }),
        expiresAt: addMs(now, ACCESS_URL_TTL_SECONDS * 1000).toISOString(),
    };
}

/** Deletes by stored `publicId` after the DB update (MEDIA-09, MEDIA-11). Avatars are removed through `DELETE /me/avatar`. */
export async function deleteMedia({ user, id, now = new Date() }) {
    const record = await findVisible(user, id);
    if (record.kind === MEDIA_KINDS.AVATARS)
        throw ApiError.conflict(ERROR_CODES.CONFLICT, {
            message: "Avatars are removed with DELETE /me/avatar",
        });
    const deleted = await softDeleteMedia({ _id: record._id }, now);
    if (!deleted) throw notFound();
    await purgeAsset(deleted, now);
    return { id: String(deleted._id), status: MEDIA_STATUSES.DELETED };
}

/**
 * For other modules (content, certificates): the `ready` media record owned by `user` in their org, as a DTO.
 * Anything else answers 404 MEDIA_NOT_FOUND, so a caller cannot attach a foreign or unconfirmed upload.
 */
export async function findReadyMedia({ user, id }) {
    const record = await Media.findOne({
        _id: toObjectId(id, "mediaId"),
        orgId: user.orgId,
        ownerId: user.id,
        status: MEDIA_STATUSES.READY,
    });
    if (!record) throw notFound();
    return toPublicMedia(record);
}
