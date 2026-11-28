import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { ApiError } from "#utils/apiError.js";
import { attachDeps } from "#utils/requestContext.js";
import { AUDIT_LIMITS } from "./audit.constants.js";
import {
    listAuditHandler,
    simulateTamperHandler,
    verifyChainHandler,
} from "./audit.controller.js";
import { emptyQuery, listAuditQuery, tamperBody } from "./audit.validation.js";

/** Per-user limits keyed by the signed-in user, never multiplied in tests (R10). */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * The tamper demo is off unless `AUDIT_TAMPER_DEMO` is on. It answers 404 when off, so the route does not advertise itself.
 * It runs after the role check (BE-42), so only a platform admin ever learns whether it exists.
 */
const requireTamperDemo = (config) => (_req, _res, next) =>
    config.audit?.tamperDemo === true ? next() : next(ApiError.notFound());

/**
 * Router for `/admin/audit` (doc 08 section 7.6, doc 10 section 5). The list is open to admins (their own organisation) and
 * platform admins (all). Verifying the chain and the tamper demo are platform-admin only because the chain is global across
 * organisations. Guard order: authenticate, authorize, (demo switch), per-user limit, strict validation, controller.
 */
export function createAuditRouter({ config = env } = {}) {
    const router = Router();
    router.use(attachDeps({ config }));
    const authenticate = createAuthenticate({ config });
    const readers = authorize(ROLES.ADMIN, ROLES.SUPERADMIN);
    const platformAdmin = authorize(ROLES.SUPERADMIN);

    router.get(
        "/",
        authenticate,
        readers,
        byUser(AUDIT_LIMITS.read),
        validate({ query: listAuditQuery }),
        listAuditHandler
    );
    router.get(
        "/verify",
        authenticate,
        platformAdmin,
        byUser(AUDIT_LIMITS.verify),
        validate({ query: emptyQuery }),
        verifyChainHandler
    );
    router.post(
        "/demo/tamper",
        authenticate,
        platformAdmin,
        requireTamperDemo(config),
        byUser(AUDIT_LIMITS.demo),
        validate({ body: tamperBody }),
        simulateTamperHandler
    );
    return router;
}
