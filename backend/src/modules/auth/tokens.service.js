import { env } from "#config/env.js";
import { AUTH_TOKEN_TTL_MS } from "#constants/tokenTypes.js";
import { signAccessToken } from "#utils/accessToken.js";
import { hmacRefreshToken, randomToken, sha256Hex } from "#utils/hash.js";
import { gt, gte } from "#utils/mongoOps.js";
import { AuthToken } from "./authToken.model.js";

/** Access JWT for `user` (a lean or hydrated user). `sid` is the refresh family, or null for a limited session. */
export function createAccessToken(user, sid, config = env) {
    return signAccessToken(
        {
            userId: user._id ?? user.id,
            role: user.role,
            orgId: user.orgId,
            sid,
            tokenVersion: user.tokenVersion,
        },
        config
    );
}

/** Keyed hash (HMAC-SHA256 with REFRESH_TOKEN_SECRET) of a refresh token, the only form that is stored (AUTH-05). */
export const hashRefreshToken = (token, config = env) =>
    hmacRefreshToken(String(token), config.auth.refreshSecret);

/** New opaque refresh token: 32 random bytes, URL-safe, with the hash to store. */
export function generateRefreshToken(config = env) {
    const token = randomToken();
    return { token, tokenHash: hashRefreshToken(token, config) };
}

/** Fresh double-submit CSRF value (AUTH-16). */
export const generateCsrfToken = () => randomToken();

const kindFilter = (kind) => (kind ? { "meta.kind": kind } : {});

/** Expires every still-valid token of this user, type and (for email change) kind: a newer token supersedes them. */
export function supersedeEmailTokens(
    { userId, type, kind },
    { session, now = new Date() } = {}
) {
    return AuthToken.updateMany(
        { userId, type, usedAt: null, expiresAt: gt(now), ...kindFilter(kind) },
        { $set: { expiresAt: now } },
        { session }
    );
}

/**
 * Creates a one-time email token (AUTH-29, AUTH-47): 32 random bytes, only the SHA-256 hash is stored, bound to the
 * user and the address at issue, valid for the type's TTL (verify 24 h, reset 30 min, invite 7 d, email change 24 h).
 * Older unused tokens of the same type for the user are invalidated first. Returns the raw token for the email link.
 */
export async function issueEmailToken(
    { type, userId, email, orgId, meta, ctx = {}, supersede = true },
    { session, now = new Date() } = {}
) {
    if (supersede && userId) {
        await supersedeEmailTokens(
            { userId, type, kind: meta?.kind },
            { session, now }
        );
    }
    const token = randomToken();
    const [record] = await AuthToken.create(
        [
            {
                type,
                email,
                tokenHash: sha256Hex(token),
                expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MS[type]),
                ...(userId ? { userId } : {}),
                ...(orgId ? { orgId } : {}),
                ...(meta ? { meta } : {}),
                ...(ctx.ipHash ? { createdIpHash: ctx.ipHash } : {}),
                ...(ctx.userAgent ? { createdUserAgent: ctx.userAgent } : {}),
            },
        ],
        { session }
    );
    return { token, record };
}

const validFilter = (token, type, kind, now) => ({
    tokenHash: sha256Hex(String(token)),
    type,
    usedAt: null,
    expiresAt: gt(now),
    ...kindFilter(kind),
});

/**
 * Atomically marks a token used (single use, AUTH-51): a conditional update on "unused and unexpired", so two
 * concurrent requests cannot both win. Returns the token record, or null for expired, used, unknown or malformed tokens
 * (callers answer all of those with one generic error code, AUTH-52).
 */
export function consumeEmailToken(
    { token, type, kind },
    { session, now = new Date() } = {}
) {
    return AuthToken.findOneAndUpdate(
        validFilter(token, type, kind, now),
        { $set: { usedAt: now } },
        { returnDocument: "after", session }
    ).lean();
}

/** Non-consuming validity check (reset-password/validate, R34). Returns the record or null. */
export function peekEmailToken(
    { token, type, kind },
    { now = new Date() } = {}
) {
    return AuthToken.findOne(validFilter(token, type, kind, now)).lean();
}

/** How many tokens of this type were issued to the user since `since` (resend and forgot caps, silent limits). */
export function countIssuedSince({ userId, type }, since) {
    return AuthToken.countDocuments({ userId, type, createdAt: gte(since) });
}

/** When the user's newest token of this type was issued, or null (the 60 s resend cooldown). */
export async function lastIssuedAt({ userId, type }) {
    const latest = await AuthToken.findOne({ userId, type })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean();
    return latest?.createdAt ?? null;
}
