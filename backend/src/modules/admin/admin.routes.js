import { Router } from "express";
import { env } from "#config/env.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { emailService as defaultEmailService } from "#services/email.service.js";
import { logger } from "#utils/logger.js";
import { attachDeps } from "#utils/requestContext.js";
import { ADMIN_LIMITS } from "./admin.constants.js";
import { createInviteRoutes } from "./adminInvites.routes.js";
import { createUserRoutes } from "./adminUsers.routes.js";

// All admin limits are per signed-in user, so they are never relaxed by RATE_LIMIT_IP_MULTIPLIER (R10).
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * Builds the `/admin` router (doc 08 section 11): invitations and user management. Dependencies are injectable for
 * tests; every call creates its own rate-limit counters.
 */
export function createAdminRouter({
    config = env,
    emailService = defaultEmailService,
    log = logger,
} = {}) {
    const deps = {
        config,
        emailService,
        log,
        limiters: Object.freeze({
            read: byUser(ADMIN_LIMITS.read),
            invitesWrite: byUser(ADMIN_LIMITS.invitesWrite),
            usersWrite: byUser(ADMIN_LIMITS.usersWrite),
        }),
    };
    const router = Router();
    router.use(attachDeps(deps));
    router.use(createInviteRoutes(deps));
    router.use(createUserRoutes(deps));
    return router;
}
