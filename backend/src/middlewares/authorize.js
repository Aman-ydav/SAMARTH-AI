import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";

/**
 * Role guard (AUTH-60): allows only the listed roles, with no implicit hierarchy (list `superadmin` explicitly).
 * Runs after `authenticate`; without `req.auth` it answers 401, a role outside the list answers 403 FORBIDDEN.
 * @param {...string} roles
 */
export function authorize(...roles) {
    if (roles.length === 0) {
        throw new TypeError("authorize() needs at least one role");
    }
    const allowed = new Set(roles);
    return (req, _res, next) => {
        if (!req.auth)
            return next(ApiError.unauthorized(ERROR_CODES.AUTH_REQUIRED));
        if (!allowed.has(req.auth.role)) {
            return next(ApiError.forbidden(ERROR_CODES.FORBIDDEN));
        }
        return next();
    };
}
