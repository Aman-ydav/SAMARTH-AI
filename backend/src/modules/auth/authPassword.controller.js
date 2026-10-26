import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { buildRequestContext } from "#utils/requestContext.js";
import { sendSignIn } from "#utils/sessionResponse.js";
import { changePassword as changeOwnPassword } from "./account.service.js";
import { NEUTRAL_MESSAGES } from "./auth.constants.js";
import {
    forgotPassword as requestReset,
    resetPassword as applyReset,
    validateResetToken,
} from "./passwordReset.service.js";

export const forgotPassword = asyncHandler(async (req, res) => {
    requestReset(req.validated.body, buildRequestContext(req));
    return ApiResponse.ok(null, NEUTRAL_MESSAGES.FORGOT_PASSWORD).send(res);
});

export const validateReset = asyncHandler(async (req, res) => {
    const result = await validateResetToken(req.validated.body);
    return ApiResponse.ok(result, "Reset link is valid").send(res);
});

export const resetPassword = asyncHandler(async (req, res) => {
    await applyReset(req.validated.body, buildRequestContext(req));
    return ApiResponse.ok(
        null,
        "Password updated. Sign in with your new password."
    ).send(res);
});

export const changePassword = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await changeOwnPassword(
        { ...req.validated.body, userId: req.auth.userId, sid: req.auth.sid },
        ctx
    );
    return sendSignIn(res, ctx, result, "Password changed");
});
