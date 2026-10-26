import { COOKIE_NAMES } from "#constants/cookieNames.js";
import { getCurrentUser } from "#modules/users/index.js";
import { ApiResponse } from "#utils/apiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { buildRequestContext } from "#utils/requestContext.js";
import { sendSignIn } from "#utils/sessionResponse.js";
import { NEUTRAL_MESSAGES } from "./auth.constants.js";
import { googleSignIn } from "./google.service.js";
import { loginWithPassword } from "./login.service.js";
import * as logoutService from "./logout.service.js";
import { refreshSession } from "./refresh.service.js";
import { registerUser } from "./register.service.js";
import { listSessions } from "./session.service.js";
import { resendVerification, verifyEmail } from "./verification.service.js";

export const register = asyncHandler(async (req, res) => {
    await registerUser(req.validated.body, buildRequestContext(req));
    return ApiResponse.accepted(null, NEUTRAL_MESSAGES.REGISTER).send(res);
});

export const verify = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await verifyEmail(req.validated.body, ctx);
    return sendSignIn(res, ctx, result, "Email verified");
});

export const resend = asyncHandler(async (req, res) => {
    resendVerification(req.validated.body, buildRequestContext(req));
    return ApiResponse.ok(null, NEUTRAL_MESSAGES.RESEND_VERIFICATION).send(res);
});

export const login = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await loginWithPassword(req.validated.body, ctx);
    return sendSignIn(res, ctx, result, "Signed in");
});

export const google = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await googleSignIn(req.validated.body, ctx);
    return sendSignIn(res, ctx, result, "Signed in with Google");
});

export const refresh = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const { grace, accessToken, ...session } = await refreshSession({
        refreshToken: req.cookies?.[COOKIE_NAMES.REFRESH],
        ctx,
    });
    if (grace) ctx.cookies.setAccessCookie(res, accessToken);
    else ctx.cookies.setSessionCookies(res, { accessToken, ...session });
    return ApiResponse.ok(null, "Session refreshed").send(res);
});

export const logout = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    await logoutService.logout(
        { refreshToken: req.cookies?.[COOKIE_NAMES.REFRESH] },
        ctx
    );
    ctx.cookies.clearAuthCookies(res);
    return ApiResponse.ok(null, "Signed out").send(res);
});

export const logoutAll = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    await logoutService.logoutAll(req.auth);
    ctx.cookies.clearAuthCookies(res);
    return ApiResponse.ok(null, "Signed out everywhere").send(res);
});

export const me = asyncHandler(async (req, res) => {
    const current = await getCurrentUser(req.auth.userId);
    return ApiResponse.ok(current, "Current user").send(res);
});

export const sessions = asyncHandler(async (req, res) => {
    const items = await listSessions(req.auth.userId, req.auth.sid);
    return ApiResponse.ok({ items }, "Sessions").send(res);
});

export const revokeSession = asyncHandler(async (req, res) => {
    const ctx = buildRequestContext(req);
    const result = await logoutService.revokeSession({
        userId: req.auth.userId,
        orgId: req.auth.orgId,
        familyId: req.validated.params.id,
        currentSid: req.auth.sid,
    });
    if (result.wasCurrent) ctx.cookies.clearAuthCookies(res);
    return ApiResponse.ok(null, "Session revoked").send(res);
});
