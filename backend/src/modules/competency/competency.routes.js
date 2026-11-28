import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { attachDeps } from "#utils/requestContext.js";
import { COMPETENCY_RATE_LIMITS } from "./competency.constants.js";
import {
    getMyCompetencies,
    getMyGaps,
    getRoleRequirements,
    listCompetencies,
    listRoles,
    submitSelfAssessment,
} from "./competency.controller.js";
import {
    emptyQuery,
    gapsQuery,
    roleIdParams,
    selfAssessmentBody,
} from "./competency.validation.js";

/** Per-user limits keyed by the signed-in user, never multiplied in tests (R10). */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * Router for `/competencies`: the framework, role profiles and the signed-in user's own competency profile. The framework
 * and the roles are reference data but are only used inside the signed-in app, so they need a session too. Every role has
 * a profile, so all four roles are listed explicitly (AUTH-60). Guard order: authenticate, authorize, per-user limit,
 * strict validation, controller.
 */
export function createCompetencyRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const anyRole = authorize(
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN
    );
    const readLimit = byUser(COMPETENCY_RATE_LIMITS.read);
    const writeLimit = byUser(COMPETENCY_RATE_LIMITS.write);
    router.use(attachDeps({ config }));

    router.get(
        "/framework",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: emptyQuery }),
        listCompetencies
    );
    router.get(
        "/roles",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: emptyQuery }),
        listRoles
    );
    router.get(
        "/roles/:id",
        authenticate,
        anyRole,
        readLimit,
        validate({ params: roleIdParams, query: emptyQuery }),
        getRoleRequirements
    );
    router.get(
        "/me",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: emptyQuery }),
        getMyCompetencies
    );
    router.post(
        "/me/self-assessment",
        authenticate,
        anyRole,
        writeLimit,
        validate({ body: selfAssessmentBody }),
        submitSelfAssessment
    );
    router.get(
        "/me/gaps",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: gapsQuery }),
        getMyGaps
    );

    return router;
}
