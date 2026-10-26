import pinoHttp from "pino-http";
import { logger as rootLogger } from "#utils/logger.js";

const QUIET_PATHS = new Set(["/health", "/ready"]);

/**
 * One structured line per request (BE-80): method, path (no query string), status, duration, request id, user id.
 * Bodies, headers and cookies are never logged (BE-81). Health probes are skipped to keep logs readable.
 */
export function requestLogger(log = rootLogger) {
    return pinoHttp({
        logger: log,
        genReqId: (req) => req.id,
        autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url) },
        customLogLevel: (_req, res, error) =>
            error || res.statusCode >= 500
                ? "error"
                : res.statusCode >= 400
                  ? "warn"
                  : "info",
        customProps: (req) => ({ requestId: req.id, userId: req.user?.id }),
        customSuccessMessage: () => "request completed",
        customErrorMessage: () => "request failed",
        serializers: {
            req: (req) => ({
                method: req.method,
                path: String(req.url ?? "").split("?")[0],
            }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    });
}
