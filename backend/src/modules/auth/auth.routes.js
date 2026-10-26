import { Router } from "express";
import { env } from "#config/env.js";
import { createGoogleVerifier } from "#integrations/google/google.adapter.js";
import { createLimiter } from "#middlewares/rateLimit.js";
import { emailService as defaultEmailService } from "#services/email.service.js";
import { createCookieHelpers } from "#utils/cookies.js";
import { hmacIdentifier } from "#utils/hash.js";
import { logger } from "#utils/logger.js";
import { attachDeps } from "#utils/requestContext.js";
import { normalizeEmail } from "#utils/strings.js";
import { AUTH_LIMITS } from "./auth.constants.js";
import { createAccountRoutes } from "./authAccount.routes.js";
import { createPasswordRoutes } from "./authPassword.routes.js";
import { createSessionRoutes } from "./authSession.routes.js";

// Per-IP limits are multiplied by RATE_LIMIT_IP_MULTIPLIER (R10); per-email and per-user limits never are.
function buildLimiters(config) {
    const multiplier = config.rateLimit.ipMultiplier;
    const secret = config.auth.identifierHashSecret;
    const byIp = (spec) => createLimiter({ ...spec, multiplier });
    const byEmail = (spec) =>
        createLimiter({
            ...spec,
            ipScoped: false,
            key: (req) =>
                typeof req.body?.email === "string"
                    ? hmacIdentifier(normalizeEmail(req.body.email), secret)
                    : "no-email",
        });
    const byUser = (spec) =>
        createLimiter({
            ...spec,
            ipScoped: false,
            key: (req) => req.auth?.userId ?? "anonymous",
        });
    return Object.freeze({
        register: byIp(AUTH_LIMITS.register),
        verifyEmail: byIp(AUTH_LIMITS.verifyEmail),
        resendVerification: byIp(AUTH_LIMITS.resendVerification),
        loginIp: byIp(AUTH_LIMITS.loginIp),
        loginEmail: byEmail(AUTH_LIMITS.loginEmail),
        google: byIp(AUTH_LIMITS.google),
        refresh: byIp(AUTH_LIMITS.refresh),
        forgotIp: byIp(AUTH_LIMITS.forgotIp),
        reset: byIp(AUTH_LIMITS.reset),
        changePassword: byUser(AUTH_LIMITS.changePassword),
        changeEmail: byUser(AUTH_LIMITS.changeEmail),
        changeEmailToken: byIp(AUTH_LIMITS.changeEmailToken),
        unlinkGoogle: byUser(AUTH_LIMITS.unlinkGoogle),
        deleteAccount: byUser(AUTH_LIMITS.deleteAccount),
        acceptInvite: byIp(AUTH_LIMITS.acceptInvite),
    });
}

/**
 * Builds the `/auth` router (doc 08 section 3). Dependencies are injectable for tests and default to the real ones:
 * `config` (validated env), `emailService`, `cookies` helpers, `log`, and `verifyGoogleCredential` (Google adapter).
 * Every call creates its own rate-limit counters.
 */
export function createAuthRouter({
    config = env,
    emailService = defaultEmailService,
    log = logger,
    cookies = createCookieHelpers(config),
    verifyGoogleCredential = createGoogleVerifier({
        clientId: config.google.clientId,
    }),
} = {}) {
    const deps = {
        config,
        emailService,
        log,
        cookies,
        verifyGoogleCredential,
        limiters: buildLimiters(config),
    };
    const router = Router();
    router.use(attachDeps(deps));
    router.use(createSessionRoutes(deps));
    router.use(createPasswordRoutes(deps));
    router.use(createAccountRoutes(deps));
    return router;
}
