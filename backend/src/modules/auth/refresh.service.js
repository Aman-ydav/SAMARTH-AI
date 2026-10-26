import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { SESSION_REVOKED_REASONS, USER_STATUSES } from "#constants/statuses.js";
import { REFRESH_GRACE_MS } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { addMs, earliestDate, isExpired } from "#utils/dates.js";
import { gt } from "#utils/mongoOps.js";
import { FRONTEND_PATHS } from "./auth.constants.js";
import { RefreshSession } from "./refreshSession.model.js";
import { revokeFamily, slidingMs } from "./session.service.js";
import {
    createAccessToken,
    generateCsrfToken,
    generateRefreshToken,
    hashRefreshToken,
} from "./tokens.service.js";

const MAX_TOKEN_LENGTH = 200;

// Every refresh failure looks the same to the client (AUTH-64, doc 08 #8).
const invalid = () => ApiError.unauthorized(ERROR_CODES.REFRESH_INVALID);

const familyIsLive = (familyId, now) =>
    RefreshSession.exists({ familyId, revokedAt: null, expiresAt: gt(now) });

async function reportReuse({ row, ctx, now }) {
    await revokeFamily(row.familyId, SESSION_REVOKED_REASONS.REUSE_DETECTED, {
        now,
    });
    const user = await User.findById(row.userId).lean();
    await appendAudit(
        {
            actorId: row.userId,
            orgId: row.orgId,
            action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
            entityType: "user",
            entityId: row.userId,
            meta: { familyId: row.familyId },
        },
        { now }
    );
    if (!user) return;
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.TOKEN_REUSE_ALERT,
        lang: user.locale,
        data: {
            name: user.name,
            at: now.toISOString(),
            resetLink: buildFrontendLink(
                FRONTEND_PATHS.FORGOT_PASSWORD,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
}

// A token that was already rotated: harmless inside the 10 s multi-tab window, theft otherwise (AUTH-07, AUTH-08).
async function handleRotatedToken({ row, ctx, now }) {
    if (row.revokedReason !== SESSION_REVOKED_REASONS.ROTATED) throw invalid();
    if (!(await familyIsLive(row.familyId, now))) throw invalid();
    if (now.getTime() - new Date(row.revokedAt).getTime() <= REFRESH_GRACE_MS) {
        return { grace: true, row };
    }
    await reportReuse({ row, ctx, now });
    throw invalid();
}

function newRowFor(row, ctx, now) {
    const { token, tokenHash } = generateRefreshToken(ctx.config);
    return {
        token,
        document: {
            orgId: row.orgId,
            userId: row.userId,
            familyId: row.familyId,
            tokenHash,
            expiresAt: earliestDate(
                addMs(now, slidingMs(ctx.config, row.remember)),
                row.absoluteExpiresAt
            ),
            absoluteExpiresAt: row.absoluteExpiresAt,
            ipHash: ctx.ipHash,
            userAgent: ctx.userAgent,
            userAgentHash: ctx.userAgentHash,
            lastUsedAt: now,
            remember: row.remember,
        },
    };
}

// Marks the presented row rotated and inserts its successor in one transaction. Returns null when another request
// rotated the row first (the conditional update matched nothing).
function rotateRow(row, ctx, now) {
    const next = newRowFor(row, ctx, now);
    return withTransaction(async (session) => {
        const claimed = await RefreshSession.findOneAndUpdate(
            { _id: row._id, revokedAt: null },
            {
                $set: {
                    revokedAt: now,
                    revokedReason: SESSION_REVOKED_REASONS.ROTATED,
                },
            },
            { session, returnDocument: "after" }
        );
        if (!claimed) return null;
        const [fresh] = await RefreshSession.create([next.document], {
            session,
        });
        await RefreshSession.updateOne(
            { _id: row._id },
            { $set: { replacedBy: fresh._id } },
            { session }
        );
        return { token: next.token };
    });
}

// Decides what a presented token means: a live row is rotated, an already-rotated one is grace or reuse.
async function resolveOutcome({ row, ctx, now }) {
    if (row.revokedAt) {
        return {
            current: row,
            outcome: await handleRotatedToken({ row, ctx, now }),
        };
    }
    if (
        isExpired(row.expiresAt, now) ||
        isExpired(row.absoluteExpiresAt, now)
    ) {
        throw invalid();
    }
    const rotated = await rotateRow(row, ctx, now);
    if (rotated)
        return {
            current: row,
            outcome: { grace: false, token: rotated.token },
        };
    // Lost the race to a concurrent request: our token counts as just rotated.
    const current = await RefreshSession.findById(row._id).lean();
    return {
        current,
        outcome: await handleRotatedToken({ row: current, ctx, now }),
    };
}

/**
 * Exchanges a refresh token for a new one (AUTH-06..08, R6). Outcomes:
 * - rotated: `{ user, familyId, remember, refreshToken }` with a brand-new refresh token (same family);
 * - grace: `{ ..., refreshToken: null, grace: true }`, the token was rotated less than 10 s ago (multi-tab race), so
 *   only a fresh access token is issued and no alarm is raised;
 * - anything else throws 401 REFRESH_INVALID. A rotated token presented after the window revokes the whole family,
 *   audits `TOKEN_REUSE_DETECTED` and mails the owner first.
 *
 * @param {{ refreshToken: unknown, ctx: object, now?: Date }} input
 */
export async function rotateRefreshToken({
    refreshToken,
    ctx,
    now = new Date(),
}) {
    if (
        typeof refreshToken !== "string" ||
        refreshToken === "" ||
        refreshToken.length > MAX_TOKEN_LENGTH
    ) {
        throw invalid();
    }
    const row = await RefreshSession.findOne({
        tokenHash: hashRefreshToken(refreshToken, ctx.config),
    }).lean();
    if (!row) throw invalid();

    const { current, outcome } = await resolveOutcome({ row, ctx, now });

    const user = await User.findById(current.userId).lean();
    if (!user || user.status !== USER_STATUSES.ACTIVE) {
        // The account can no longer have a session: do not leave the freshly rotated row alive.
        await revokeFamily(current.familyId, SESSION_REVOKED_REASONS.ADMIN, {
            now,
        });
        throw invalid();
    }
    return {
        user,
        familyId: current.familyId,
        remember: current.remember,
        refreshToken: outcome.grace ? null : outcome.token,
        grace: outcome.grace,
    };
}

/**
 * `POST /auth/refresh`: rotates the token and prepares the credentials for the cookies. A normal rotation returns
 * `{ accessToken, refreshToken, csrfToken, remember }`; inside the 10 s grace window only `{ accessToken, grace: true }`
 * (no new refresh token and the csrf value stays, so the other tab's in-flight requests are not broken).
 */
export async function refreshSession({ refreshToken, ctx, now = new Date() }) {
    const rotated = await rotateRefreshToken({ refreshToken, ctx, now });
    const accessToken = createAccessToken(
        rotated.user,
        rotated.familyId,
        ctx.config
    );
    if (rotated.grace) return { accessToken, grace: true };
    return {
        accessToken,
        refreshToken: rotated.refreshToken,
        csrfToken: generateCsrfToken(),
        remember: rotated.remember,
        grace: false,
    };
}
