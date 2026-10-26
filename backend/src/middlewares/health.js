import { Router } from "express";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { getDbState, pingDb } from "#db/connect.js";
import { ApiError } from "#utils/apiError.js";
import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { logger } from "#utils/logger.js";

const NOT_READY_RETRY_AFTER_SEC = 5;

/**
 * `GET /health` (process is alive, no dependencies) and `GET /ready` (database answers, else 503 with Retry-After),
 * BE-05, EDGE-54. Unauthenticated, outside `/api/v1`, exempt from rate limiting and CSRF, and they reveal no versions or config.
 */
export function healthRouter({ readinessCheck = () => pingDb() } = {}) {
    const router = Router({ caseSensitive: true });

    router.get("/health", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        ApiResponse.ok({ status: "ok" }, "OK").send(res);
    });

    router.get(
        "/ready",
        asyncHandler(async (_req, res) => {
            res.setHeader("Cache-Control", "no-store");
            let ready;
            try {
                ready = await readinessCheck();
            } catch (error) {
                ready = false;
                logger.warn({ err: error }, "readiness probe failed");
            }
            if (!ready) {
                throw ApiError.serviceUnavailable(
                    ERROR_CODES.INTEGRATION_ERROR,
                    {
                        message: "The service is not ready.",
                        retryAfterSec: NOT_READY_RETRY_AFTER_SEC,
                    }
                );
            }
            ApiResponse.ok({ status: "ready", db: getDbState() }, "OK").send(
                res
            );
        })
    );
    return router;
}
