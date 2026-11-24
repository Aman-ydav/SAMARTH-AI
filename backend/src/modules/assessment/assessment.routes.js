import { Router } from "express";
import { env } from "#config/env.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { attachDeps } from "#utils/requestContext.js";
import {
    listQuizzes,
    getQuiz,
    submitAttempt,
    getMyAttempts,
    getAttemptDetails,
} from "./assessment.controller.js";

export function createAssessmentRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    router.use(attachDeps({ config }));

    // Browse quizzes
    router.get("/quizzes", listQuizzes);
    router.get("/quizzes/:id", getQuiz);

    // Learner attempts
    router.post("/quizzes/:id/attempts", authenticate, submitAttempt);
    router.get("/me/attempts", authenticate, getMyAttempts);
    router.get("/me/attempts/:attemptId", authenticate, getAttemptDetails);

    return router;
}
