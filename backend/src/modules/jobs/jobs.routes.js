import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { getJobHandler } from "./jobs.controller.js";
import { JOB_RATE_LIMITS } from "./jobs.constants.js";
import { jobIdParams } from "./jobs.validation.js";

/** Per-user limit: it is never multiplied in tests (R10), and the key is the signed-in user, not the IP. */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * `/jobs`: read-only status of a background job for the user who started it. Any signed-in role may poll its own jobs
 * (roles are listed explicitly, AUTH-60); who may START a job is decided by the module that enqueues it.
 */
export function createJobsRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const anyRole = authorize(
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN
    );
    router.get(
        "/:id",
        authenticate,
        anyRole,
        byUser(JOB_RATE_LIMITS.read),
        validate({ params: jobIdParams }),
        getJobHandler
    );
    return router;
}
