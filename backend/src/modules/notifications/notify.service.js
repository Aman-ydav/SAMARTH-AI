import { NOTIFICATION_TYPE_LIST } from "#constants/notificationTypes.js";
import { ApiError } from "#utils/apiError.js";
import { addMs } from "#utils/dates.js";
import { toObjectId } from "#utils/mongo.js";
import { anyOf } from "#utils/mongoOps.js";
import { Notification } from "./notification.model.js";
import { NOTIFICATION_LIMITS } from "./notifications.constants.js";

const DUPLICATE_KEY = 11000;

const normaliseKey = (key) => String(key).trim().toLowerCase();

function buildDocument(input, now) {
    const { userId, orgId, type, subject, refId, link, dedupeKey } = input;
    if (!NOTIFICATION_TYPE_LIST.includes(type))
        throw ApiError.validation([
            {
                field: "type",
                message: "Unknown notification type",
                code: "invalid",
            },
        ]);
    const doc = {
        userId: toObjectId(userId, "userId"),
        orgId: toObjectId(orgId, "orgId"),
        type,
        readAt: null,
        expiresAt: addMs(now, NOTIFICATION_LIMITS.retentionMs),
    };
    if (subject !== undefined) doc.subject = subject;
    if (refId !== undefined) doc.refId = refId;
    if (link !== undefined) doc.link = link;
    if (dedupeKey !== undefined) doc.dedupeKey = normaliseKey(dedupeKey);
    return doc;
}

/** Keeps each user's newest `perUserCap` notifications; older ones go in bounded batches (DB-16). */
async function trimToCap(userId) {
    const stale = await Notification.find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .skip(NOTIFICATION_LIMITS.perUserCap)
        .limit(NOTIFICATION_LIMITS.trimBatch)
        .select("_id")
        .lean();
    if (stale.length === 0) return 0;
    const outcome = await Notification.deleteMany({
        userId,
        _id: anyOf(stale.map((item) => item._id)),
    });
    return outcome.deletedCount;
}

/** Inserts once per `{ userId, dedupeKey }`; a second delivery of the same event finds the first row (EDGE-33). */
async function insertDeduplicated(doc) {
    const filter = { userId: doc.userId, dedupeKey: doc.dedupeKey };
    // The filter fields come from the equality match on insert, so they are not repeated in $setOnInsert.
    const insert = { ...doc };
    delete insert.userId;
    delete insert.dedupeKey;
    try {
        const outcome = await Notification.updateOne(
            filter,
            { $setOnInsert: insert },
            { upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        if (outcome.upsertedCount === 1)
            return { id: String(outcome.upsertedId), created: true };
    } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error;
        // A concurrent delivery won the insert race: its row is the notification.
    }
    const existing = await Notification.findOne(filter).select("_id").lean();
    return { id: String(existing._id), created: false };
}

/**
 * Creates one in-app notification for a user (doc 22). With a `dedupeKey` the same event delivered twice, or retried,
 * yields one notification and `created: false` the second time. When a user goes over the per-user cap the oldest are
 * removed. Nothing here sends mail or push: those channels arrive with their milestone.
 *
 * @param {object} input
 * @param {string} input.userId recipient
 * @param {string} input.orgId recipient's organisation (from the event or session, never from a request body)
 * @param {string} input.type one of `NOTIFICATION_TYPES`
 * @param {string} [input.subject] short non-personal label the client shows (for example a job type)
 * @param {string} [input.refId] id of the thing it refers to
 * @param {string} [input.link] in-app path to open on click
 * @param {string} [input.dedupeKey] stable key for "this exact event for this user"
 * @param {{ now?: Date }} [options]
 * @returns {Promise<{ id: string, created: boolean }>}
 */
export async function notify(input, { now = new Date() } = {}) {
    const doc = buildDocument(input, now);
    if (doc.dedupeKey === undefined) {
        const row = await Notification.create(doc);
        await trimToCap(doc.userId);
        return { id: String(row._id), created: true };
    }
    const result = await insertDeduplicated(doc);
    if (result.created) await trimToCap(doc.userId);
    return result;
}
