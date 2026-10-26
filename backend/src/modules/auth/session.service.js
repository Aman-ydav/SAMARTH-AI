import mongoose from "mongoose";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { SESSION_REVOKED_REASONS } from "#constants/statuses.js";
import {
    REFRESH_ABSOLUTE_CAP_MS,
    REFRESH_REMEMBER_ABSOLUTE_CAP_MS,
} from "#constants/tokenTypes.js";
import { ApiError } from "#utils/apiError.js";
import { addMs, earliestDate } from "#utils/dates.js";
import { gt, ne } from "#utils/mongoOps.js";
import { summarizeUserAgent } from "#utils/userAgent.js";
import { MAX_ACTIVE_SESSIONS } from "./auth.constants.js";
import { RefreshSession } from "./refreshSession.model.js";
import { generateRefreshToken } from "./tokens.service.js";

const absoluteCapMs = (remember) =>
    remember ? REFRESH_REMEMBER_ABSOLUTE_CAP_MS : REFRESH_ABSOLUTE_CAP_MS;
export const slidingMs = (config, remember) =>
    remember
        ? config.auth.refreshRememberExpiryMs
        : config.auth.refreshExpiryMs;

const activeFilter = (now) => ({ revokedAt: null, expiresAt: gt(now) });

/** Revokes every live row of a refresh family. `reason` is one of SESSION_REVOKED_REASONS. */
export function revokeFamily(
    familyId,
    reason,
    { session, now = new Date() } = {}
) {
    return RefreshSession.updateMany(
        { familyId, revokedAt: null },
        { $set: { revokedAt: now, revokedReason: reason } },
        { session }
    );
}

/**
 * Revokes all sessions of a user (logout-all, password reset, undo), optionally keeping one family.
 * Returns the number of rows revoked.
 */
export async function revokeAllSessions(
    userId,
    reason,
    { exceptFamilyId, session, now = new Date() } = {}
) {
    const result = await RefreshSession.updateMany(
        {
            userId,
            revokedAt: null,
            ...(exceptFamilyId ? { familyId: ne(exceptFamilyId) } : {}),
        },
        { $set: { revokedAt: now, revokedReason: reason } },
        { session }
    );
    return result.modifiedCount;
}

// The 11th session pushes out the least recently used one (AUTH-10): oldest live row first.
async function enforceSessionCap(userId, now) {
    const live = await RefreshSession.find({ userId, ...activeFilter(now) })
        .sort({ createdAt: 1 })
        .select("familyId")
        .limit(MAX_ACTIVE_SESSIONS * 3)
        .lean();
    const excess = live.length - MAX_ACTIVE_SESSIONS;
    for (const row of live.slice(0, Math.max(0, excess))) {
        await revokeFamily(row.familyId, SESSION_REVOKED_REASONS.LOGOUT, {
            now,
        });
    }
}

/**
 * Starts a new session family for a device login (AUTH-10, R6). The row expires at the earlier of the sliding window
 * (7 d, remember-me 30 d) and the absolute cap (30 d, remember-me 90 d). Returns the raw refresh token for the cookie.
 */
export async function createSession({
    user,
    ctx,
    remember = false,
    now = new Date(),
}) {
    const familyId = new mongoose.Types.ObjectId().toHexString();
    const absoluteExpiresAt = addMs(now, absoluteCapMs(remember));
    const { token, tokenHash } = generateRefreshToken(ctx.config);
    const row = await RefreshSession.create({
        orgId: user.orgId,
        userId: user._id,
        familyId,
        tokenHash,
        expiresAt: earliestDate(
            addMs(now, slidingMs(ctx.config, remember)),
            absoluteExpiresAt
        ),
        absoluteExpiresAt,
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
        userAgentHash: ctx.userAgentHash,
        lastUsedAt: now,
        remember,
    });
    await enforceSessionCap(user._id, now);
    return { familyId, refreshToken: token, remember, row };
}

/** The live row of a family belonging to the user, or null (also null for a revoked or expired family). */
export function findLiveFamily(familyId, userId, now = new Date()) {
    return RefreshSession.findOne({
        familyId,
        userId,
        ...activeFilter(now),
    }).lean();
}

/** Session list item (doc 08 #19): stable `id` (the family), a short device label, and whether it is this session. */
export function toSessionView(row, currentFamilyId) {
    const startedAt = addMs(
        row.absoluteExpiresAt,
        -absoluteCapMs(row.remember)
    );
    return {
        id: row.familyId,
        device: summarizeUserAgent(row.userAgent),
        createdAt: startedAt,
        lastUsedAt: row.lastUsedAt ?? row.createdAt,
        current: row.familyId === currentFamilyId,
    };
}

/** The user's live sessions, most recently used first (at most 10 exist, AUTH-10). */
export async function listSessions(userId, currentFamilyId, now = new Date()) {
    const rows = await RefreshSession.find({ userId, ...activeFilter(now) })
        .sort({ lastUsedAt: -1 })
        .limit(MAX_ACTIVE_SESSIONS * 2)
        .lean();
    return rows.map((row) => toSessionView(row, currentFamilyId));
}

/** Revokes one of the user's own sessions; an unknown or foreign id is 404 (BE-42). Returns the revoked family id. */
export async function revokeOwnSession(userId, familyId, now = new Date()) {
    const live = await findLiveFamily(familyId, userId, now);
    if (!live) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    await revokeFamily(familyId, SESSION_REVOKED_REASONS.LOGOUT, { now });
    return familyId;
}

/**
 * Logout by refresh cookie (idempotent): revokes the family of that token when it is known and live.
 * Returns the family id, or null when there was nothing to revoke.
 */
export async function revokeByRefreshTokenHash(tokenHash, now = new Date()) {
    const row = await RefreshSession.findOne({ tokenHash })
        .select("familyId")
        .lean();
    if (!row) return null;
    await revokeFamily(row.familyId, SESSION_REVOKED_REASONS.LOGOUT, { now });
    return row.familyId;
}
