import jwt from "jsonwebtoken";
import { env } from "#config/env.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { JWT_ALGORITHM, JWT_AUDIENCE, JWT_ISSUER } from "#constants/jwt.js";
import { ROLE_LIST } from "#constants/roles.js";
import { ApiError } from "./apiError.js";
import { isValidObjectId } from "./mongo.js";

/**
 * Signs the 15-minute access JWT (AUTH-04): HS256, `iss`, `aud`, `exp`, and only the claims `sub`, `role`, `orgId`,
 * `sid` (refresh-session family) and `tv` (token version). No email, name or other PII. A limited session
 * (must-change-password, AUTH-38) has no refresh session, so it carries no `sid`.
 */
export function signAccessToken(
    { userId, role, orgId, sid, tokenVersion },
    config = env
) {
    const payload = { role, orgId: String(orgId), tv: tokenVersion };
    if (sid) payload.sid = String(sid);
    return jwt.sign(payload, config.auth.accessSecret, {
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: String(userId),
        expiresIn: Math.floor(config.auth.accessExpiryMs / 1000),
    });
}

const invalid = () => ApiError.unauthorized(ERROR_CODES.TOKEN_INVALID);

/**
 * Verifies signature (pinned algorithm), issuer, audience and expiry, then checks the claim shapes.
 * Expired tokens raise the jsonwebtoken `TokenExpiredError` (the error handler maps it to TOKEN_EXPIRED); every other
 * problem is TOKEN_INVALID. Returns `{ userId, role, orgId, sid, tokenVersion }` (`sid` is null for a limited session).
 */
export function verifyAccessToken(token, config = env) {
    const claims = jwt.verify(token, config.auth.accessSecret, {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
    });
    const { sub, role, orgId, sid = null, tv } = claims;
    if (
        !isValidObjectId(sub) ||
        !isValidObjectId(orgId) ||
        !ROLE_LIST.includes(role) ||
        !Number.isInteger(tv) ||
        tv < 0 ||
        (sid !== null && !isValidObjectId(sid))
    ) {
        throw invalid();
    }
    return { userId: sub, role, orgId, sid, tokenVersion: tv };
}
