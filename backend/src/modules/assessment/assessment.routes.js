import { Router } from "express";
import { env } from "#config/env.js";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { attachDeps } from "#utils/requestContext.js";
import { ASSESSMENT_RATE_LIMITS } from "./assessment.constants.js";
import {
    getAttemptDetails,
    getMyAttempts,
    getQuiz,
    listQuizzes,
    submitAttempt,
} from "./assessment.controller.js";
import {
    attemptIdParams,
    emptyQuery,
    listQuizzesQuery,
    quizIdParams,
    submitAttemptBody,
} from "./assessment.validation.js";

/** Per-user limits keyed by the signed-in user, never multiplied in tests (R10). */
const byUser = (spec) =>
    createLimiter({
        ...spec,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });

/**
 * Router for `/assessment`: browse quizzes and take them. Every signed-in role may practise, so all four roles are
 * listed explicitly (AUTH-60). Guard order: authenticate, authorize, per-user limit, strict validation, controller.
 */
export function createAssessmentRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const anyRole = authorize(
        ROLES.LEARNER,
        ROLES.TRAINER,
        ROLES.ADMIN,
        ROLES.SUPERADMIN
    );
    const readLimit = byUser(ASSESSMENT_RATE_LIMITS.read);
    const submitLimit = byUser(ASSESSMENT_RATE_LIMITS.submit);
    router.use(attachDeps({ config }));

    router.get(
        "/quizzes",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: listQuizzesQuery }),
        listQuizzes
    );
    router.get(
        "/quizzes/:id",
        authenticate,
        anyRole,
        readLimit,
        validate({ params: quizIdParams, query: emptyQuery }),
        getQuiz
    );
    router.post(
        "/quizzes/:id/attempts",
        authenticate,
        anyRole,
        submitLimit,
        validate({ params: quizIdParams, body: submitAttemptBody }),
        submitAttempt
    );
    router.get(
        "/me/attempts",
        authenticate,
        anyRole,
        readLimit,
        validate({ query: emptyQuery }),
        getMyAttempts
    );
    router.get(
        "/me/attempts/:attemptId",
        authenticate,
        anyRole,
        readLimit,
        validate({ params: attemptIdParams, query: emptyQuery }),
        getAttemptDetails
    );

    return router;
}
