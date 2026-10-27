import { Router } from "express";
import { ROLES } from "#constants/roles.js";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { validate } from "#middlewares/validate.js";
import { ADMIN_AREA_ROLES } from "./admin.constants.js";
import {
    changeRoleBody,
    idParams,
    listUsersQuery,
    setStatusBody,
} from "./admin.validation.js";
import {
    changeRoleHandler,
    listUsersHandler,
    setStatusHandler,
} from "./adminUsers.controller.js";

/**
 * User management (doc 08 section 11): list, suspend or reactivate, change role. Admins and platform admins list and
 * change status; only a platform admin changes roles. Guard order: authenticate, authorize, rate limit, validate, controller.
 */
export function createUserRoutes({ config, limiters }) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const staff = authorize(...ADMIN_AREA_ROLES);

    router.get(
        "/users",
        authenticate,
        staff,
        limiters.read,
        validate({ query: listUsersQuery }),
        listUsersHandler
    );
    router.patch(
        "/users/:id/status",
        authenticate,
        staff,
        limiters.usersWrite,
        validate({ params: idParams, body: setStatusBody }),
        setStatusHandler
    );
    router.patch(
        "/users/:id/role",
        authenticate,
        authorize(ROLES.SUPERADMIN),
        limiters.usersWrite,
        validate({ params: idParams, body: changeRoleBody }),
        changeRoleHandler
    );
    return router;
}
