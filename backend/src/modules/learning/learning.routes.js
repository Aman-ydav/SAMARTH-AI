import { Router } from "express";
import { env } from "#config/env.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { attachDeps } from "#utils/requestContext.js";
import {
    listCourses,
    getCourseDetail,
    getMyRecommendations,
    getMyLearningPath,
    enroll,
    getMyEnrolments,
    updateProgress,
} from "./learning.controller.js";

export function createLearningRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    router.use(attachDeps({ config }));

    // Catalogue browse (public)
    router.get("/courses", listCourses);
    router.get("/courses/:id", getCourseDetail);

    // Learner recommendations and pathways
    router.get("/me/recommendations", authenticate, getMyRecommendations);
    router.get("/me/learning-path", authenticate, getMyLearningPath);
    router.post("/me/enrolments", authenticate, enroll);
    router.get("/me/enrolments", authenticate, getMyEnrolments);
    router.patch("/me/enrolments/:id/progress", authenticate, updateProgress);

    return router;
}
