import {
    MEDIA_DELIVERY_TYPES,
    MEDIA_KINDS,
    MEDIA_RESOURCE_TYPES,
} from "#constants/mediaKinds.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { MEDIA_STATUSES } from "#constants/statuses.js";
import { uploadBuffer } from "#integrations/cloudinary/cloudinary.adapter.js";
import { getAuthUser, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { logger } from "#utils/logger.js";
import { Media } from "./media.model.js";
import {
    purgeAsset,
    retireMedia,
    softDeleteMedia,
} from "./mediaCleanup.service.js";

/**
 * The `users` module owns `users.avatar`, the embedded copy of a media record (rule 05); the media module is the only
 * writer and reaches it through `#modules/users/index.js` (FS-43). Both calls return `{ user, previousAvatar }`, where
 * `user` is the public user summary. The port is a plain object so tests can replace its methods.
 */
export const usersPort = {
    /** Atomically swaps the avatar; `avatar` is `{ publicId, url, bytes, format, width, height, version }`. */
    async replaceAvatar({ userId, avatar }) {
        const before = await User.findOneAndUpdate(
            { _id: userId },
            { $set: { avatar } },
            {
                returnDocument: "before",
                projection: { avatar: 1 },
                runValidators: true,
            }
        ).lean();
        if (!before) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
        return {
            user: await getAuthUser(userId),
            previousAvatar: before.avatar ?? null,
        };
    },
    /** Removes the avatar (idempotent: a user without one just gets the summary back). */
    async clearAvatar({ userId }) {
        const before = await User.findOneAndUpdate(
            { _id: userId },
            { $unset: { avatar: "" } },
            { returnDocument: "before", projection: { avatar: 1 } }
        ).lean();
        if (!before) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
        return {
            user: await getAuthUser(userId),
            previousAvatar: before.avatar ?? null,
        };
    },
};

const toUserAvatar = (asset) => ({
    publicId: asset.publicId,
    url: asset.secureUrl,
    bytes: asset.bytes,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    version: asset.version,
});

/** An avatar is always a public image; the stored user copy has no resource or delivery type. */
const imageAsset = (publicId) => ({
    publicId,
    resourceType: MEDIA_RESOURCE_TYPES.IMAGE,
    deliveryType: MEDIA_DELIVERY_TYPES.PUBLIC,
});

/**
 * Deletes the replaced avatar after the user row changed (MEDIA-11). It never throws: a failure is logged and the
 * orphan sweep retries, because the user's request already succeeded. Returns true when the old asset is gone.
 */
async function retirePrevious(previous, now) {
    if (!previous?.publicId) return false;
    try {
        const record = await softDeleteMedia(
            { publicId: previous.publicId },
            now
        );
        // A legacy avatar has no media record: delete the asset by its stored id without a DB update.
        return await purgeAsset(record ?? imageAsset(previous.publicId), now);
    } catch (error) {
        logger.warn(
            { err: error, event: "media.avatar.retire" },
            "old avatar could not be retired, left for the orphan sweep"
        );
        return false;
    }
}

/** Removes a new asset (and its record) when the user update did not happen, so the old avatar stays (EDGE-108). */
async function rollback({ record, asset, now }) {
    try {
        if (record) await retireMedia(record, now);
        else await purgeAsset(imageAsset(asset.publicId), now);
        return true;
    } catch (error) {
        logger.error(
            { err: error, event: "media.avatar.rollback" },
            "new avatar asset could not be removed, left for the orphan sweep"
        );
        return false;
    }
}

/**
 * Sets or replaces the caller's avatar (EDGE-108). `upload` is `{ file, policy }` from the upload middleware, so type,
 * magic bytes and size were already checked (MEDIA-06). Order: upload, record, user update, then delete the old asset.
 * Any failure before the user update removes the new asset again, so the old avatar stays untouched.
 */
export async function setAvatar({ user, upload, now = new Date() }) {
    const asset = await uploadBuffer({
        buffer: upload.file.buffer,
        kind: MEDIA_KINDS.AVATARS,
        policy: upload.policy,
        ownerId: String(user.id),
    });
    let record = null;
    try {
        record = await Media.create({
            orgId: user.orgId,
            ownerId: user.id,
            kind: MEDIA_KINDS.AVATARS,
            ...asset,
            status: MEDIA_STATUSES.READY,
            declaredBytes: asset.bytes,
            declaredFormat: asset.format,
            confirmedAt: now,
        });
        const result = await usersPort.replaceAvatar({
            userId: user.id,
            avatar: toUserAvatar(asset),
        });
        await retirePrevious(result.previousAvatar, now);
        return result.user;
    } catch (error) {
        await rollback({ record, asset, now });
        throw error;
    }
}

/** Removes the caller's avatar and deletes its asset. Idempotent: without an avatar it just returns the user. */
export async function removeAvatar({ user, now = new Date() }) {
    const result = await usersPort.clearAvatar({ userId: user.id });
    await retirePrevious(result.previousAvatar, now);
    return result.user;
}
