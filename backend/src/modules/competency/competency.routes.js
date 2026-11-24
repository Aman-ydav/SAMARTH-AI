import { Router } from "express";
import { env } from "#config/env.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { attachDeps } from "#utils/requestContext.js";
import {
    listCompetencies,
    listRoles,
    getRoleRequirements,
    getMyCompetencies,
    submitSelfAssessment,
    getMyGaps,
} from "./competency.controller.js";

export function createCompetencyRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    router.use(attachDeps({ config }));

    // Public / Framework routes
    router.get("/framework", listCompetencies);
    router.get("/roles", listRoles);
    router.get("/roles/:id", getRoleRequirements);

    // Learner authenticated routes
    router.get("/me", authenticate, getMyCompetencies);
    router.post("/me/self-assessment", authenticate, submitSelfAssessment);
    router.get("/me/gaps", authenticate, getMyGaps);

    return router;
}
