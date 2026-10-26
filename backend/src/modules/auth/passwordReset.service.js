import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import {
    EMAIL_TEMPLATES,
    PASSWORD_RESET_VARIANTS,
} from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import {
    AUTH_PROVIDERS,
    SESSION_REVOKED_REASONS,
    USER_STATUSES,
} from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { runInBackground } from "#utils/backgroundTasks.js";
import { normalizeEmail } from "#utils/strings.js";
import { FORGOT_PASSWORD, FRONTEND_PATHS, HOUR_MS } from "./auth.constants.js";
import { clearEmailAttempts, emailAttemptKey } from "./loginAttempt.service.js";
import {
    assertNotReused,
    assertPasswordPolicy,
    hashPassword,
    nextPasswordHistory,
} from "./password.service.js";
import { describeTtl } from "./register.service.js";
import { revokeAllSessions } from "./session.service.js";
import {
    consumeEmailToken,
    countIssuedSince,
    issueEmailToken,
    peekEmailToken,
} from "./tokens.service.js";

const TYPE = AUTH_TOKEN_TYPES.PASSWORD_RESET;
const invalidToken = () => ApiError.badRequest(ERROR_CODES.RESET_TOKEN_INVALID);

// Accounts that may reset: suspended, pending-deletion, invited and deleted ones never get a link (AUTH-48).
const RESETTABLE = new Set([
    USER_STATUSES.ACTIVE,
    USER_STATUSES.PENDING_VERIFICATION,
    USER_STATUSES.DEACTIVATED,
]);

function variantOf(user) {
    if (user.status === USER_STATUSES.PENDING_VERIFICATION)
        return PASSWORD_RESET_VARIANTS.UNVERIFIED;
    if (!user.passwordHash) return PASSWORD_RESET_VARIANTS.GOOGLE_ONLY;
    return PASSWORD_RESET_VARIANTS.ACTIVE;
}

async function sendResetLink({ email, ctx, now }) {
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !RESETTABLE.has(user.status)) return;
    const recent = await countIssuedSince(
        { userId: user._id, type: TYPE },
        new Date(now.getTime() - HOUR_MS)
    );
    if (recent >= FORGOT_PASSWORD.MAX_PER_HOUR) return; // silent per-email limit (AUTH-46)
    const { token } = await issueEmailToken(
        {
            type: TYPE,
            userId: user._id,
            orgId: user.orgId,
            email: user.email,
            ctx,
        },
        { now }
    );
    await appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
            entityType: "user",
            entityId: user._id,
            meta: { variant: variantOf(user) },
        },
        { now }
    );
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.PASSWORD_RESET,
        lang: user.locale,
        data: {
            name: user.name,
            link: buildFrontendLink(
                FRONTEND_PATHS.RESET_PASSWORD,
                { token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(TYPE),
            requestedAt: now.toISOString(),
            variant: variantOf(user),
        },
    });
}

/**
 * Forgot password (AUTH-46..49). Returns at once; the lookup, the silent 3-per-hour cap, the token and the mail all
 * happen after the response, so the answer and its timing are identical for every address. A new token kills older ones.
 */
export function forgotPassword({ email }, ctx, now = new Date()) {
    const normalized = normalizeEmail(email);
    runInBackground(() => sendResetLink({ email: normalized, ctx, now }), {
        log: ctx.log,
        label: "forgot password",
    });
}

// Loads the token's user and checks the token is still bound to the same address and the account may reset.
async function loadResetTarget(record) {
    const user = await User.findById(record.userId).select(
        "+passwordHash +passwordHistory"
    );
    if (!user || user.email !== record.email || !RESETTABLE.has(user.status))
        throw invalidToken();
    return user;
}

/** Non-consuming token check for the reset page (R34). Same `RESET_TOKEN_INVALID` for every kind of bad token. */
export async function validateResetToken({ token }, now = new Date()) {
    const record = await peekEmailToken({ token, type: TYPE }, { now });
    if (!record) throw invalidToken();
    await loadResetTarget(record);
    return { valid: true };
}

function resetUpdate(user, passwordHash, now) {
    const pending = user.status === USER_STATUSES.PENDING_VERIFICATION;
    return {
        $set: {
            passwordHash,
            passwordChangedAt: now,
            passwordHistory: nextPasswordHistory(
                user.passwordHash,
                user.passwordHistory
            ),
            failedLoginCount: 0,
            lockoutCount: 0,
            lockUntil: null,
            mustChangePassword: false,
            ...(pending
                ? {
                      status: USER_STATUSES.ACTIVE,
                      emailVerified: true,
                      emailVerifiedAt: now,
                  }
                : {}),
        },
        $inc: { tokenVersion: 1 },
        $addToSet: { authProviders: AUTH_PROVIDERS.LOCAL },
    };
}

/**
 * Reset password (AUTH-51..54). Order: the token must be valid and still bound to the account; the new password must
 * pass the policy and differ from the current and last three hashes (all BEFORE anything is consumed); then, in one
 * transaction, the token is consumed atomically, the password is replaced, `tokenVersion` is bumped, ALL sessions are
 * revoked and lock counters are cleared. Nothing logs the user in.
 */
export async function resetPassword(
    { token, newPassword },
    ctx,
    now = new Date()
) {
    const record = await peekEmailToken({ token, type: TYPE }, { now });
    if (!record) throw invalidToken();
    const user = await loadResetTarget(record);
    assertPasswordPolicy(
        newPassword,
        { email: user.email, name: user.name },
        "newPassword"
    );
    await assertNotReused(newPassword, user);
    const passwordHash = await hashPassword(newPassword);

    await withTransaction(async (session) => {
        const consumed = await consumeEmailToken(
            { token, type: TYPE },
            { session, now }
        );
        if (!consumed) throw invalidToken();
        const updated = await User.findOneAndUpdate(
            { _id: user._id, email: record.email, status: user.status },
            resetUpdate(user, passwordHash, now),
            { session, returnDocument: "after" }
        );
        if (!updated) throw invalidToken();
        await revokeAllSessions(
            user._id,
            SESSION_REVOKED_REASONS.PASSWORD_CHANGE,
            { session, now }
        );
        await appendAudit(
            {
                actorId: user._id,
                orgId: user.orgId,
                action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
                entityType: "user",
                entityId: user._id,
            },
            { session, now }
        );
    });

    await clearEmailAttempts(emailAttemptKey(user.email, ctx.config));
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.PASSWORD_CHANGED,
        lang: user.locale,
        data: {
            name: user.name,
            changedAt: now.toISOString(),
            resetLink: buildFrontendLink(
                FRONTEND_PATHS.FORGOT_PASSWORD,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
}
