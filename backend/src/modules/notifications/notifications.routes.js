import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import {
    dismissNotificationHandler,
    getUnreadCountHandler,
    listNotificationsHandler,
    markAllReadHandler,
    markReadHandler,
} from "./notifications.controller.js";
import { NOTIFICATION_RATE_LIMITS } from "./notifications.constants.js";
import {
    emptyBody,
    emptyQuery,
    listNotificationsQuery,
    notificationIdParams,
} from "./notifications.validation.js";

/** Per-user limits keyed by the signed-in user, never multiplied in tests (R10). */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * Router for `/me/notifications` (doc 22 section 7): the signed-in user's own in-app notifications. Every role has
 * a notification centre, so all four roles are listed explicitly (AUTH-60). Guard order: authenticate, authorize,
 * per-user limit, strict validation, controller. `read-all` is declared before `/:id/read` so the fixed path wins.
 */
export function createNotificationsRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const anyRole = authorize(
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN
    );
    const readLimit = byUser(NOTIFICATION_RATE_LIMITS.read);
    const countLimit = byUser(NOTIFICATION_RATE_LIMITS.count);
    const writeLimit = byUser(NOTIFICATION_RATE_LIMITS.write);

    router.get(
        "/",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: listNotificationsQuery }),
        listNotificationsHandler
    );
    router.get(
        "/unread-count",
        authenticate,
        anyRole,
        countLimit,
        validate({ query: emptyQuery }),
        getUnreadCountHandler
    );
    router.post(
        "/read-all",
        authenticate,
        anyRole,
        writeLimit,
        validate({ body: emptyBody }),
        markAllReadHandler
    );
    router.post(
        "/:id/read",
        authenticate,
        anyRole,
        writeLimit,
        validate({ params: notificationIdParams, body: emptyBody }),
        markReadHandler
    );
    router.delete(
        "/:id",
        authenticate,
        anyRole,
        writeLimit,
        validate({ params: notificationIdParams }),
        dismissNotificationHandler
    );
    return router;
}
