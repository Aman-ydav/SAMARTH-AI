import { MEDIA_STATUSES } from "#constants/statuses.js";
import { assertWebhookSignature } from "#integrations/cloudinary/cloudinary.adapter.js";
import { logger } from "#utils/logger.js";
import { lt } from "#utils/mongoOps.js";
import { Media } from "./media.model.js";
import { webhookPayloadSchema } from "./media.validation.js";
import {
    markPurged,
    purgeAsset,
    softDeleteMedia,
} from "./mediaCleanup.service.js";

const ACTIONS = Object.freeze({
    RECONCILED: "reconciled",
    REJECTED: "rejected",
    DELETED: "deleted",
    IGNORED: "ignored",
});

const compact = (values) =>
    Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined)
    );

function parsePayload(rawBody) {
    try {
        const parsed = webhookPayloadSchema.safeParse(JSON.parse(rawBody));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** A newer version of a confirmed asset: refresh the stored facts. A duplicate or older delivery matches nothing. */
async function reconcileUpload(payload) {
    if (!payload.public_id || payload.version === undefined) return false;
    const updated = await Media.findOneAndUpdate(
        {
            publicId: payload.public_id,
            status: MEDIA_STATUSES.READY,
            version: lt(payload.version),
        },
        {
            $set: compact({
                version: payload.version,
                bytes: payload.bytes,
                width: payload.width,
                height: payload.height,
                format: payload.format,
                secureUrl: payload.secure_url,
            }),
        },
        { returnDocument: "after", runValidators: true }
    );
    return updated !== null;
}

/** Moderation rejected the asset: retire the record and delete the asset. A repeated delivery finds nothing live. */
async function rejectAsset(payload, now) {
    if (payload.moderation_status !== "rejected" || !payload.public_id)
        return false;
    const record = await softDeleteMedia({ publicId: payload.public_id }, now);
    if (!record) return false;
    await purgeAsset(record, now);
    return true;
}

/** Cloudinary reports assets removed outside our API: mark the records deleted and purged. */
async function markDeleted(payload, now) {
    const ids = (payload.resources ?? []).map((item) => item.public_id);
    if (payload.public_id) ids.push(payload.public_id);
    let changed = 0;
    for (const publicId of ids) {
        const record = await softDeleteMedia({ publicId }, now);
        if (record) {
            // Cloudinary says the asset is already gone: no delete call is needed.
            await markPurged(record, now);
            changed += 1;
        }
    }
    return changed > 0;
}

/**
 * Handles a Cloudinary notification (MEDIA-15, EDGE-53): verifies the signature over the RAW body first, then reconciles
 * state idempotently. Every update is conditional on the stored version or status, so a duplicate delivery changes nothing.
 * The webhook never makes a record `ready`: only `confirm` does (MEDIA-15a). Unknown or irrelevant notifications are
 * acknowledged so Cloudinary stops retrying.
 */
export async function handleMediaWebhook({
    rawBody,
    timestamp,
    signature,
    now = new Date(),
}) {
    assertWebhookSignature({
        rawBody,
        timestamp,
        signature,
        now: now.getTime(),
    });
    const payload = parsePayload(rawBody);
    if (!payload) return { received: true, action: ACTIONS.IGNORED };

    const handlers = {
        upload: async () =>
            (await reconcileUpload(payload)) ? ACTIONS.RECONCILED : null,
        moderation: async () =>
            (await rejectAsset(payload, now)) ? ACTIONS.REJECTED : null,
        delete: async () =>
            (await markDeleted(payload, now)) ? ACTIONS.DELETED : null,
    };
    const handler = Object.hasOwn(handlers, payload.notification_type)
        ? handlers[payload.notification_type]
        : null;
    const action = handler ? await handler() : null;
    logger.info(
        {
            event: "media.webhook",
            type: payload.notification_type,
            action: action ?? ACTIONS.IGNORED,
        },
        "cloudinary notification handled"
    );
    return { received: true, action: action ?? ACTIONS.IGNORED };
}
