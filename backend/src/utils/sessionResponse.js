import { ApiResponse } from "./apiResponse.js";

/**
 * Sends a login-type success response (login, Google, verify, invite, change password): the cookies come from
 * `result.session` through the cookie helpers, the body carries only the user summary and flags, never a token (AUTH-37).
 * @param {import("express").Response} res
 * @param {{ cookies: object }} ctx request context holding the cookie helpers
 * @param {{ session: object }} result what `signInUser` returned
 * @param {string} message
 */
export function sendSignIn(res, ctx, result, message) {
    const { session, ...body } = result;
    ctx.cookies.setSessionCookies(res, session);
    return ApiResponse.ok(body, message).send(res);
}
