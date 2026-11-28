import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { toObjectId } from "#utils/mongo.js";
import { ne } from "#utils/mongoOps.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { Notification } from "./notification.model.js";

/**
 * The notification as its owner may see it (BE-47): what it is about, whether it is read and when it was created.
 * Tenant and user ids are never returned. The client renders the text from `type` and `subject`.
 */
export function toPublicNotification(notification) {
    return {
        id: String(notification._id),
        type: notification.type,
        subject: notification.subject ?? null,
        refId: notification.refId ?? null,
        link: notification.link ?? null,
        read: Boolean(notification.readAt),
        readAt: notification.readAt ?? null,
        createdAt: notification.createdAt,
    };
}

/** Every query starts from the owner and organisation of the session, never from the request (BE-43, AUTH-62). */
const scopeOf = ({ userId, orgId }) => ({
    userId: toObjectId(userId, "userId"),
    orgId: toObjectId(orgId, "orgId"),
});

const notFound = () => ApiError.notFound(ERROR_CODES.NOTIFICATION_NOT_FOUND);

/** Newest first. `unread` is `"true"` for unread only, `"false"` for read only, absent for all (EDGE-110). */
export async function listNotifications({ userId, orgId, query }) {
    const page = parsePagination(query, {
        allowedSort: ["createdAt"],
        defaultSort: "createdAt",
        defaultOrder: "desc",
    });
    const filter = scopeOf({ userId, orgId });
    if (query.unread === "true") filter.readAt = null;
    if (query.unread === "false") filter.readAt = ne(null);
    const [items, total] = await Promise.all([
        Notification.find(filter)
            .sort(page.sort)
            .skip(page.skip)
            .limit(page.limit)
            .lean(),
        Notification.countDocuments(filter),
    ]);
    return {
        items: items.map(toPublicNotification),
        meta: buildPageMeta({ page: page.page, limit: page.limit, total }),
    };
}

/** The bell badge. Bounded by the per-user cap, so the count is cheap. */
export async function countUnread({ userId, orgId }) {
    const unreadCount = await Notification.countDocuments({
        ...scopeOf({ userId, orgId }),
        readAt: null,
    });
    return { unreadCount };
}

/** Marks one notification read. Repeating it returns the same notification (idempotent, EDGE-30); a foreign or missing one is 404. */
export async function markRead({ userId, orgId, id, now = new Date() }) {
    const filter = { _id: toObjectId(id, "id"), ...scopeOf({ userId, orgId }) };
    const updated = await Notification.findOneAndUpdate(
        { ...filter, readAt: null },
        { $set: { readAt: now } },
        { returnDocument: "after", lean: true }
    );
    if (updated) return toPublicNotification(updated);
    const existing = await Notification.findOne(filter).lean();
    if (!existing) throw notFound();
    return toPublicNotification(existing);
}

/** Marks every unread notification of the user read and says how many changed. */
export async function markAllRead({ userId, orgId, now = new Date() }) {
    const outcome = await Notification.updateMany(
        { ...scopeOf({ userId, orgId }), readAt: null },
        { $set: { readAt: now } }
    );
    return { updated: outcome.modifiedCount };
}

/** Removes one notification of the user (dismiss). It is short-lived data, so this is a hard delete. */
export async function dismissNotification({ userId, orgId, id }) {
    const outcome = await Notification.deleteOne({
        _id: toObjectId(id, "id"),
        ...scopeOf({ userId, orgId }),
    });
    if (outcome.deletedCount === 0) throw notFound();
}
