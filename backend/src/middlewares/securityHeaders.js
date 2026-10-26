import helmet from "helmet";
import { env } from "#config/env.js";

/**
 * Helmet for a JSON API (BE-60): a CSP that allows nothing, no framing, no referrer, HSTS only in production.
 * `x-powered-by` is removed by helmet (and disabled on the app).
 */
export function securityHeaders({ isProduction = env.isProduction } = {}) {
    return helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'none'"],
                formAction: ["'none'"],
            },
        },
        frameguard: { action: "deny" },
        referrerPolicy: { policy: "no-referrer" },
        crossOriginResourcePolicy: { policy: "same-site" },
        strictTransportSecurity: isProduction
            ? { maxAge: 15_552_000, includeSubDomains: true }
            : false,
    });
}

/** `Cache-Control: no-store` for API responses: auth and personal data must never be cached (BE-60, AUTH-14). */
export function noStore() {
    return (_req, res, next) => {
        res.setHeader("Cache-Control", "no-store");
        next();
    };
}
