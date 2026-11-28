import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import * as notifications from "./notifications.service.js";

/** Who is asking comes from the verified session, never from the request body or query (EDGE-22). */
const whoIs = (req) => ({ userId: req.auth.userId, orgId: req.auth.orgId });

export const listNotificationsHandler = asyncHandler(async (req, res) => {
    const { items, meta } = await notifications.listNotifications({
        ...whoIs(req),
        query: req.validated.query,
    });
    return ApiResponse.ok({ notifications: items }, "Notifications", meta).send(
        res
    );
});

export const getUnreadCountHandler = asyncHandler(async (req, res) => {
    const data = await notifications.countUnread(whoIs(req));
    return ApiResponse.ok(data, "Unread notifications").send(res);
});

export const markReadHandler = asyncHandler(async (req, res) => {
    const notification = await notifications.markRead({
        ...whoIs(req),
        id: req.validated.params.id,
    });
    return ApiResponse.ok({ notification }, "Notification marked read").send(
        res
    );
});

export const markAllReadHandler = asyncHandler(async (req, res) => {
    const data = await notifications.markAllRead(whoIs(req));
    return ApiResponse.ok(data, "Notifications marked read").send(res);
});

export const dismissNotificationHandler = asyncHandler(async (req, res) => {
    await notifications.dismissNotification({
        ...whoIs(req),
        id: req.validated.params.id,
    });
    return ApiResponse.noContent().send(res);
});
