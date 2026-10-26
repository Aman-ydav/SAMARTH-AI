import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";

/** Last route: unknown paths get the standard 404 envelope through the error handler (BE-02). */
export function notFound() {
    return (_req, _res, next) =>
        next(
            ApiError.notFound(ERROR_CODES.NOT_FOUND, {
                message: "Route not found",
            })
        );
}
