import { env } from "#config/env.js";
import { getIpHash, getUserAgent, getUserAgentHash } from "./clientInfo.js";

/**
 * Router factories call this to hand their dependencies (`config`, `emailService`, `cookies`, ...) to the controllers
 * of one router: controllers are plain exported handlers, so the dependencies travel on the request as `req.deps`.
 */
export const attachDeps = (deps) => (req, _res, next) => {
    req.deps = deps;
    next();
};

/**
 * The plain, request-derived data services need (they never see `req`, BE-50): request id, hashed IP, truncated
 * user agent and its hash (R37, AUTH-58), the router's dependencies, and `mail(message)` which queues an email after
 * the response and tags failures with the request id (BE-72, BE-73).
 */
export function buildRequestContext(req) {
    const deps = req.deps ?? {};
    const config = deps.config ?? env;
    const secret = config.auth.identifierHashSecret;
    return {
        ...deps,
        config,
        mail: (message) =>
            deps.emailService.enqueueEmail(message, { requestId: req.id }),
        requestId: req.id,
        ipHash: getIpHash(req, secret),
        userAgent: getUserAgent(req),
        userAgentHash: getUserAgentHash(req, secret),
    };
}
