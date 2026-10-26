import { ApiError } from "#utils/apiError.js";

/** Request header carrying the JSON of the acting user in route tests that run without the real auth module. */
export const USER_HEADER = "x-test-user";

/**
 * Stand-ins for `authenticate` / `authorize(...roles)` (rule 03 BE-24, rule 04 AUTH-60): the user comes from a test
 * header, a missing header is 401 AUTH_REQUIRED, a role outside the list is 403 FORBIDDEN. Inject them into a router factory.
 */
export function headerAuth() {
    return {
        authenticate(req, _res, next) {
            const raw = req.get(USER_HEADER);
            if (!raw) return next(ApiError.unauthorized());
            req.user = JSON.parse(raw);
            return next();
        },
        authorize: (...roles) =>
            function authorizeRoles(req, _res, next) {
                return roles.includes(req.user?.role)
                    ? next()
                    : next(ApiError.forbidden());
            },
    };
}

/** Value for the user header. */
export const asHeader = (user) => JSON.stringify(user);
