import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { USER_STATUSES } from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { findUserByEmail, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { runInBackground } from "#utils/backgroundTasks.js";
import {
    HOUR_MS,
    FRONTEND_PATHS,
    RESEND_VERIFICATION,
} from "./auth.constants.js";
import { sendVerificationEmail } from "./register.service.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";
import {
    consumeEmailToken,
    countIssuedSince,
    issueEmailToken,
    lastIssuedAt,
} from "./tokens.service.js";

const invalidToken = () =>
    ApiError.badRequest(ERROR_CODES.VERIFY_TOKEN_INVALID);

/**
 * Confirms an email address with the one-time token from the link (AUTH-32, R34). The token is consumed atomically in
 * the same transaction that activates the account, and is bound to the user AND the address it was issued for. Every
 * failure (expired, used, unknown, malformed, wrong user, account no longer pending) is `VERIFY_TOKEN_INVALID`.
 * Success starts a session; the first device is recorded without a "new sign-in" mail.
 *
 * @param {{ token: string }} input
 * @param {object} ctx request context
 */
export async function verifyEmail({ token }, ctx, now = new Date()) {
    const user = await withTransaction(async (session) => {
        const record = await consumeEmailToken(
            { token, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY },
            { session, now }
        );
        if (!record) throw invalidToken();
        const activated = await User.findOneAndUpdate(
            {
                _id: record.userId,
                email: record.email,
                status: USER_STATUSES.PENDING_VERIFICATION,
            },
            {
                $set: {
                    status: USER_STATUSES.ACTIVE,
                    emailVerified: true,
                    emailVerifiedAt: now,
                },
            },
            { session, returnDocument: "after" }
        );
        if (!activated) throw invalidToken();
        await appendAudit(
            {
                actorId: activated._id,
                orgId: activated.orgId,
                action: AUDIT_ACTIONS.EMAIL_VERIFIED,
                entityType: "user",
                entityId: activated._id,
            },
            { session, now }
        );
        return activated;
    });

    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.WELCOME,
        lang: user.locale,
        data: {
            name: user.name,
            link: buildFrontendLink(
                FRONTEND_PATHS.ONBOARDING,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
    return signInUser({
        user,
        ctx,
        method: SIGN_IN_METHODS.VERIFY_EMAIL,
        notifyDevice: false,
        now,
    });
}

// Silent rules (AUTH-30): unknown or not-pending address, 60 s cooldown, 5 per hour. None of them is visible to the caller.
async function sendFreshVerification({ email, ctx, now }) {
    const user = await findUserByEmail(email);
    if (!user || user.status !== USER_STATUSES.PENDING_VERIFICATION) return;
    const type = AUTH_TOKEN_TYPES.EMAIL_VERIFY;
    const last = await lastIssuedAt({ userId: user._id, type });
    if (
        last &&
        now.getTime() - last.getTime() < RESEND_VERIFICATION.COOLDOWN_MS
    )
        return;
    const recent = await countIssuedSince(
        { userId: user._id, type },
        new Date(now.getTime() - HOUR_MS)
    );
    if (recent >= RESEND_VERIFICATION.MAX_PER_HOUR) return;
    const { token } = await issueEmailToken(
        { type, userId: user._id, orgId: user.orgId, email: user.email, ctx },
        { now }
    );
    sendVerificationEmail({ user, token, ctx });
}

/**
 * Resend verification (AUTH-30). Returns immediately; the lookup, caps and mailing happen after the response, so the
 * answer and its timing are the same for every address. A new token invalidates the previous one.
 */
export function resendVerification({ email }, ctx, now = new Date()) {
    runInBackground(() => sendFreshVerification({ email, ctx, now }), {
        log: ctx.log,
        label: "resend verification",
    });
}
