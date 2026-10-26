import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { SESSION_REVOKED_REASONS } from "#constants/statuses.js";
import { appendAudit } from "#modules/audit/index.js";
import { toObjectId } from "#utils/mongo.js";
import {
    revokeAllSessions,
    revokeByRefreshTokenHash,
    revokeOwnSession,
} from "./session.service.js";
import { hashRefreshToken } from "./tokens.service.js";

/** Logout (idempotent): revokes the session of the refresh cookie when it is known; unknown or missing is fine. */
export async function logout({ refreshToken }, ctx, now = new Date()) {
    if (typeof refreshToken !== "string" || refreshToken === "") return null;
    return revokeByRefreshTokenHash(
        hashRefreshToken(refreshToken, ctx.config),
        now
    );
}

/** Logout everywhere: revokes every session of the user and audits `LOGOUT_ALL`. Returns how many rows were revoked. */
export async function logoutAll({ userId, orgId }, now = new Date()) {
    const revoked = await revokeAllSessions(
        userId,
        SESSION_REVOKED_REASONS.LOGOUT_ALL,
        { now }
    );
    await appendAudit(
        {
            actorId: userId,
            orgId,
            action: AUDIT_ACTIONS.LOGOUT_ALL,
            entityType: "user",
            entityId: userId,
            meta: { revoked },
        },
        { now }
    );
    return revoked;
}

/** Revokes one of the user's own sessions (400 for a bad id, 404 for foreign or unknown ones, BE-42) and audits `SESSION_REVOKED`. */
export async function revokeSession(
    { userId, orgId, familyId: rawId, currentSid },
    now = new Date()
) {
    const familyId = toObjectId(rawId).toHexString();
    await revokeOwnSession(userId, familyId, now);
    await appendAudit(
        {
            actorId: userId,
            orgId,
            action: AUDIT_ACTIONS.SESSION_REVOKED,
            entityType: "user",
            entityId: userId,
            meta: { current: familyId === currentSid },
        },
        { now }
    );
    return { wasCurrent: familyId === currentSid };
}
