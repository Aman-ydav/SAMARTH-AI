import {
    createInvite,
    listInvites as listInvitations,
    resendInvite as resendInvitation,
    revokeInvite as revokeInvitation,
    toInviteView,
} from "#modules/auth/index.js";
import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { buildRequestContext } from "#utils/requestContext.js";

export const createInviteHandler = asyncHandler(async (req, res) => {
    const invite = await createInvite(
        req.validated.body,
        req.auth,
        buildRequestContext(req)
    );
    return ApiResponse.created(
        { invite: toInviteView(invite) },
        "Invitation sent"
    ).send(res);
});

export const listInvitesHandler = asyncHandler(async (req, res) => {
    const { items, meta } = await listInvitations(
        req.auth,
        req.validated.query
    );
    return ApiResponse.ok({ invites: items }, "Invitations", meta).send(res);
});

export const revokeInviteHandler = asyncHandler(async (req, res) => {
    const invite = await revokeInvitation(req.auth, req.validated.params.id);
    return ApiResponse.ok({ invite }, "Invitation revoked").send(res);
});

export const resendInviteHandler = asyncHandler(async (req, res) => {
    const invite = await resendInvitation(
        req.auth,
        req.validated.params.id,
        buildRequestContext(req)
    );
    return ApiResponse.ok({ invite }, "Invitation sent again").send(res);
});
