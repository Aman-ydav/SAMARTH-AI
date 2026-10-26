import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import { env } from "#config/env.js";
import { API_PREFIX, BODY_LIMIT, RAW_BODY_PATHS } from "#constants/http.js";
import { corsMiddleware } from "#middlewares/cors.js";
import { csrfProtection } from "#middlewares/csrf.js";
import { createErrorHandler } from "#middlewares/errorHandler.js";
import { healthRouter } from "#middlewares/health.js";
import { notFound } from "#middlewares/notFound.js";
import { globalLimiter } from "#middlewares/rateLimit.js";
import { requestId } from "#middlewares/requestId.js";
import { requestLogger } from "#middlewares/requestLogger.js";
import { sanitizeInput } from "#middlewares/sanitizeInput.js";
import { noStore, securityHeaders } from "#middlewares/securityHeaders.js";
import {
    shouldMountTestOutbox,
    TEST_OUTBOX_PATH,
    testOutboxRouter,
} from "#middlewares/testOutbox.js";
import { createAuthRouter } from "#modules/auth/index.js";
import { mediaRouter } from "#modules/media/index.js";
import { createUsersRouter } from "#modules/users/index.js";
import { emailService as defaultEmailService } from "#services/email.service.js";
import { createCookieHelpers } from "#utils/cookies.js";
import { logger as defaultLogger } from "#utils/logger.js";
import { sanitizingQueryParser } from "#utils/sanitize.js";

/**
 * Mounts the feature module routers on the `/api/v1` router, after CSRF and before the 404 handler (BE-02, R27).
 * Module owners add ONE line each, e.g. `api.use("/auth", authRouter);`, importing the router from
 * `#modules/<name>/index.js` (FS-43). Each router declares its own rate limit, authenticate, authorize and validate chain.
 * `deps` is `{ config, emailService, log }` of the app being built, so routers use the same config and mail outbox.
 */
function mountModules(api, deps) {
    api.use("/auth", createAuthRouter(deps));
    api.use("/profile", createUsersRouter(deps));
    // Serves /media/* and /me/avatar, so it is mounted at "/" and declares absolute paths (see media.routes.js).
    api.use("/", mediaRouter);
    return api;
}

// Keeps the raw bytes for routes that verify a provider signature over the exact body (MEDIA-15).
const captureRawBody = (req, _res, buffer) => {
    if (RAW_BODY_PATHS.includes(req.originalUrl.split("?")[0]))
        req.rawBody = buffer.toString("utf8");
};

/**
 * Builds the Express app without listening or connecting to the database (BE-01), so Supertest can use it.
 * Middleware order is fixed by BE-02: request id, helmet, CORS, compression, body parsers, cookie parser, sanitiser,
 * global rate limiter, request logger, health, `/api/v1` (CSRF first), 404, error handler.
 *
 * @param {object} [options]
 * @param {object} [options.config] validated config (defaults to `env`)
 * @param {(api: import("express").Router, deps: { config: object, emailService: object, log: object }) => void} [options.mountRoutes] mounts feature routers (tests pass their own)
 * @param {() => Promise<boolean>} [options.readinessCheck] `/ready` probe (defaults to a database ping)
 * @param {object} [options.log] pino logger
 * @param {object} [options.emailService] email service whose memory outbox backs the test-only endpoint
 */
export function createApp({
    config = env,
    mountRoutes = mountModules,
    readinessCheck,
    log = defaultLogger,
    emailService = defaultEmailService,
} = {}) {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", config.trustProxy);
    app.set("case sensitive routing", true);
    app.set("query parser", sanitizingQueryParser());

    app.use(requestId());
    app.use(securityHeaders({ isProduction: config.isProduction }));
    app.use(corsMiddleware(config.corsAllowedOrigins));
    app.use(compression());
    app.use(
        express.json({
            limit: BODY_LIMIT,
            strict: true,
            verify: captureRawBody,
        })
    );
    app.use(
        express.urlencoded({
            extended: false,
            limit: BODY_LIMIT,
            parameterLimit: 100,
        })
    );
    app.use(cookieParser());
    app.use(sanitizeInput());
    app.use(globalLimiter(config));
    app.use(requestLogger(log));
    app.use(healthRouter(readinessCheck ? { readinessCheck } : undefined));

    const api = express.Router({ caseSensitive: true });
    api.use(noStore());
    api.use(
        csrfProtection({
            enabled: config.cookies.csrfEnabled,
            allowedOrigins: config.corsAllowedOrigins,
            cookieHelpers: createCookieHelpers(config),
        })
    );
    if (shouldMountTestOutbox(config) && emailService.outbox)
        api.use(TEST_OUTBOX_PATH, testOutboxRouter(emailService.outbox));
    mountRoutes(api, { config, emailService, log });
    app.use(API_PREFIX, api);

    app.use(notFound());
    app.use(createErrorHandler({ isDevelopment: config.isDevelopment, log }));
    return app;
}
