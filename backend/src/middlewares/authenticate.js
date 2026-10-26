import mongoose from "mongoose";
import { env } from "#config/env.js";
import { COOKIE_NAMES } from "#constants/cookieNames.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { USER_STATUSES } from "#constants/statuses.js";
import { verifyAccessToken } from "#utils/accessToken.js";
import { ApiError } from "#utils/apiError.js";
import { gt } from "#utils/mongoOps.js";
import { asyncHandler } from "#utils/asyncHandler.js";

// Inactive accounts: suspended and deactivated users are told why (the client shows its own page); all others look revoked.
const INACTIVE_CODES = Object.freeze({
    [USER_STATUSES.SUSPENDED]: ERROR_CODES.ACCOUNT_SUSPENDED,
    [USER_STATUSES.DEACTIVATED]: ERROR_CODES.ACCOUNT_DEACTIVATED,
});

/**
 * Builds the `authenticate` middleware (AUTH-13, BE-24). It reads the `sai_access` cookie, verifies the JWT, then
 * re-checks the database on every request: the user is active, `tv` equals the user's token version, and the session
 * (refresh family `sid`) still has an unrevoked, unexpired row. The status is never cached (the rule allows up to 30 s).
 *
 * Sets `req.auth = { id, userId, role, orgId, sid, tokenVersion, limited }` (role and org come from the database, never
 * from the client) and `req.user` as the same object, which the request logger reads.
 *
 * A limited session (must-change-password, AUTH-38) has no `sid`; it is accepted only when `allowLimited` is true,
 * which only `POST /auth/change-password` uses. Models are looked up by name so this middleware has no module imports.
 *
 * @param {{ config?: object, allowLimited?: boolean }} [options]
 */
export function createAuthenticate({
    config = env,
    allowLimited = false,
} = {}) {
    return asyncHandler(async (req, _res, next) => {
        const token = req.cookies?.[COOKIE_NAMES.ACCESS];
        if (typeof token !== "string" || token === "") {
            throw ApiError.unauthorized(ERROR_CODES.AUTH_REQUIRED);
        }
        const claims = verifyAccessToken(token, config);

        const user = await mongoose
            .model("User")
            .findById(claims.userId)
            .select("role orgId status tokenVersion mustChangePassword")
            .lean();
        if (!user) throw ApiError.unauthorized(ERROR_CODES.TOKEN_INVALID);
        if (user.status !== USER_STATUSES.ACTIVE) {
            const code = INACTIVE_CODES[user.status];
            throw code
                ? ApiError.forbidden(code)
                : ApiError.unauthorized(ERROR_CODES.SESSION_REVOKED);
        }
        if (user.tokenVersion !== claims.tokenVersion) {
            throw ApiError.unauthorized(ERROR_CODES.TOKEN_INVALID);
        }

        const limited = claims.sid === null;
        if (limited && !user.mustChangePassword) {
            throw ApiError.unauthorized(ERROR_CODES.TOKEN_INVALID);
        }
        if (user.mustChangePassword && !allowLimited) {
            throw ApiError.forbidden(ERROR_CODES.MUST_CHANGE_PASSWORD);
        }
        if (!limited) {
            const session = await mongoose.model("RefreshSession").exists({
                familyId: claims.sid,
                userId: user._id,
                revokedAt: null,
                expiresAt: gt(new Date()),
            });
            if (!session)
                throw ApiError.unauthorized(ERROR_CODES.SESSION_REVOKED);
        }

        const auth = {
            id: String(user._id),
            userId: String(user._id),
            role: user.role,
            orgId: String(user.orgId),
            sid: claims.sid,
            tokenVersion: user.tokenVersion,
            limited,
        };
        req.auth = auth;
        req.user = auth;
        next();
    });
}

/** Default middleware for protected routes. */
export const authenticate = createAuthenticate();

/** Variant for the only route a must-change-password session may call (`POST /auth/change-password`). */
export const authenticateAllowLimited = createAuthenticate({
    allowLimited: true,
});
