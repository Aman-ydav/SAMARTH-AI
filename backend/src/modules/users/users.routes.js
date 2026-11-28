import { Router } from "express";
import { env } from "#config/env.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { validate } from "#middlewares/validate.js";
import { attachDeps } from "#utils/requestContext.js";
import { completeOnboarding, getProfile, updateProfile } from "./users.controller.js";
import { emptyQuery, onboardingBody, updateProfileBody } from "./users.validation.js";

/**
 * Router for `/profile` (doc 08 section 6): the signed-in user's own account profile.
 * Guard order: authenticate, validate, controller. Only `name`, `locale` and `timezone` can change here.
 */
export function createUsersRouter({ config = env } = {}) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const onboardingLimiter = createLimiter({
        name: "profile-onboarding",
        windowMs: 60 * 60_000,
        limit: 20,
        ipScoped: false,
        key: (req) => req.auth?.userId ?? "anonymous",
    });
    router.use(attachDeps({ config }));
    router.get("/", authenticate, validate({ query: emptyQuery }), getProfile);
    router.put(
        "/",
        authenticate,
        validate({ body: updateProfileBody }),
        updateProfile
    );
    router.patch(
        "/onboarding",
        authenticate,
        onboardingLimiter,
        validate({ body: onboardingBody }),
        completeOnboarding
    );
    return router;
}
