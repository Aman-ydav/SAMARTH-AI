import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { buildRequestContext } from "#utils/requestContext.js";
import { sendSignIn } from "#utils/sessionResponse.js";
import { deleteAccount as scheduleDeletion } from "./account.service.js";
import { NEUTRAL_MESSAGES } from "./auth.constants.js";
import {
    confirmEmailChange,
    requestEmailChange,
    undoEmailChange,
} from "./emailChange.service.js";
import { unlinkGoogle as removeGoogle } from "./google.service.js";
import { acceptInvite as acceptInvitation } from "./invite.service.js";

export const unlinkGoogle = asyncHandler(async (req, res) => {
    const user = await removeGoogle(
        { userId: req.auth.userId, credential: req.validated.body.credential },
        buildRequestContext(req)
    );
    return ApiResponse.ok({ user }, "Google unlinked").send(res);
});

export const changeEmail = asyncHandler(async (req, res) => {
    await requestEmailChange(
        { ...req.validated.body, userId: req.auth.userId },
        buildRequestContext(req)
    );
    return ApiResponse.accepted(null, NEUTRAL_MESSAGES.CHANGE_EMAIL).send(res);
});

export const confirmChangeEmail = asyncHandler(async (req, res) => {
    const result = await confirmEmailChange(
        req.validated.body,
        buildRequestContext(req)
    );
    return ApiResponse.ok(result, "Email address updated").send(res);
});

export const undoChangeEmail = asyncHandler(async (req, res) => {
    const result = await undoEmailChange(
        req.validated.body,
        buildRequestContext(req)
    );
    return ApiResponse.ok(result, "Email change undone. Sign in again.").send(
        res
    );
});

export const deleteAccount = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await scheduleDeletion(
        { ...req.validated.body, userId: req.auth.userId },
        ctx
    );
    ctx.cookies.clearAuthCookies(res);
    return ApiResponse.ok(
        { graceEndsAt: result.graceEndsAt.toISOString() },
        "Account scheduled for deletion"
    ).send(res);
});

export const acceptInvite = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await acceptInvitation(req.validated.body, ctx);
    return sendSignIn(res, ctx, result, "Invitation accepted");
});
