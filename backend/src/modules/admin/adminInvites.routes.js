import { Router } from "express";
import { createAuthenticate } from "#middlewares/authenticate.js";
import { authorize } from "#middlewares/authorize.js";
import { validate } from "#middlewares/validate.js";
import { ADMIN_AREA_ROLES } from "./admin.constants.js";
import {
    createInviteBody,
    idParams,
    listInvitesQuery,
} from "./admin.validation.js";
import {
    createInviteHandler,
    listInvitesHandler,
    resendInviteHandler,
    revokeInviteHandler,
} from "./adminInvites.controller.js";

/**
 * Invitations (doc 08 section 11): create, list, revoke, resend. Guard order: authenticate, authorize (admin and platform
 * admin), rate limit, validate, controller. Who may invite which role is decided by the service (INVITE_GRANTS, R68).
 */
export function createInviteRoutes({ config, limiters }) {
    const router = Router();
    const authenticate = createAuthenticate({ config });
    const staff = authorize(...ADMIN_AREA_ROLES);

    router.post(
        "/invites",
        authenticate,
        staff,
        limiters.invitesWrite,
        validate({ body: createInviteBody }),
        createInviteHandler
    );
    router.get(
        "/invites",
        authenticate,
        staff,
        limiters.read,
        validate({ query: listInvitesQuery }),
        listInvitesHandler
    );
    router.delete(
        "/invites/:id",
        authenticate,
        staff,
        limiters.invitesWrite,
        validate({ params: idParams }),
        revokeInviteHandler
    );
    router.post(
        "/invites/:id/resend",
        authenticate,
        staff,
        limiters.invitesWrite,
        validate({ params: idParams }),
        resendInviteHandler
    );
    return router;
}
