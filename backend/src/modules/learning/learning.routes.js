import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { attachDeps } from "#utils/requestContext.js";
import { LEARNING_RATE_LIMITS } from "./learning.constants.js";
import {
    enroll,
    getCourseDetail,
    getMyEnrolments,
    getMyLearningPath,
    getMyRecommendations,
    listCourses,
    updateProgress,
} from "./learning.controller.js";
import {
    courseIdParams,
    emptyQuery,
    enrolBody,
    listCoursesQuery,
    progressBody,
    targetRoleQuery,
} from "./learning.validation.js";

/** Per-user limits keyed by the signed-in user, never multiplied in tests (R10). */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * Router for `/learning`: the course catalogue, the signed-in user's recommendations, path and enrolments. The catalogue is
 * only used inside the signed-in app, so it needs a session too. Every role may learn, so all four roles are listed
 * explicitly (AUTH-60). Guard order: authenticate, authorize, per-user limit, strict validation, controller.
 */
export function createLearningRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const anyRole = authorize(
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN
    );
    const readLimit = byUser(LEARNING_RATE_LIMITS.read);
    const writeLimit = byUser(LEARNING_RATE_LIMITS.write);
    router.use(attachDeps({ config }));

    router.get(
        "/courses",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: listCoursesQuery }),
        listCourses
    );
    router.get(
        "/courses/:id",
        authenticate,
        anyRole,
        readLimit,
        validate({ params: courseIdParams, query: emptyQuery }),
        getCourseDetail
    );
    router.get(
        "/me/recommendations",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: targetRoleQuery }),
        getMyRecommendations
    );
    router.get(
        "/me/learning-path",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: targetRoleQuery }),
        getMyLearningPath
    );
    router.post(
        "/me/enrolments",
        authenticate,
        anyRole,
        writeLimit,
        validate({ body: enrolBody }),
        enroll
    );
    router.get(
        "/me/enrolments",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: emptyQuery }),
        getMyEnrolments
    );
    router.patch(
        "/me/enrolments/:id/progress",
        authenticate,
        anyRole,
        writeLimit,
        validate({ params: courseIdParams, body: progressBody }),
        updateProgress
    );

    return router;
}
