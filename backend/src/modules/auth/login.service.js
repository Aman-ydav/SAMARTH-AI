import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { USER_STATUSES } from "#constants/statuses.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { normalizeEmail } from "#utils/strings.js";
import { FRONTEND_PATHS } from "./auth.constants.js";
import {
    clearEmailAttempts,
    emailAttemptKey,
    getActiveLock,
    recordFailure,
} from "./loginAttempt.service.js";
import { verifyPassword } from "./password.service.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";

const invalidCredentials = () =>
    ApiError.unauthorized(ERROR_CODES.INVALID_CREDENTIALS);

const lockedError = (lock) =>
    ApiError.locked(ERROR_CODES.ACCOUNT_LOCKED, {
        retryAfterSec: lock.retryAfterSec,
        errors: [
            {
                field: "retryAfterSec",
                message: String(lock.retryAfterSec),
                code: ERROR_CODES.ACCOUNT_LOCKED,
            },
        ],
    });

// Counts the failure for the email key (real or not), mirrors it on a real user, and mails/audits a fresh lock.
async function failAttempt({ user, emailKey, ctx, now }) {
    const result = await recordFailure({ emailKey, ipKey: ctx.ipHash }, now);
    await appendAudit(
        {
            orgId: user?.orgId,
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            entityType: "user",
            entityId: user?._id,
            meta: { emailHash: emailKey },
        },
        { now }
    );
    if (!user) return;
    const mirror = {
        $set: { failedLoginCount: result.count, lockUntil: result.lockUntil },
        ...(result.lockUntil ? { $inc: { lockoutCount: 1 } } : {}),
    };
    await User.updateOne({ _id: user._id }, mirror);
    if (!result.justLocked) return;
    await appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
            entityType: "user",
            entityId: user._id,
            meta: { lockUntil: result.lockUntil.toISOString() },
        },
        { now }
    );
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.ACCOUNT_LOCKED,
        lang: user.locale,
        data: {
            name: user.name,
            unlockAt: result.lockUntil.toISOString(),
            resetLink: buildFrontendLink(
                FRONTEND_PATHS.FORGOT_PASSWORD,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
}

/**
 * Status gate after a CORRECT credential (AUTH-35, R18): throws the status error, or returns the reactivation that
 * signing in performs (deactivated + `reactivate: true`, or pending deletion) so the caller can apply it.
 */
export async function checkStatus({ user, reactivate, now }) {
    switch (user.status) {
        case USER_STATUSES.ACTIVE:
            return null;
        case USER_STATUSES.PENDING_VERIFICATION:
            throw ApiError.forbidden(ERROR_CODES.EMAIL_NOT_VERIFIED);
        case USER_STATUSES.SUSPENDED:
            throw ApiError.forbidden(ERROR_CODES.ACCOUNT_SUSPENDED);
        case USER_STATUSES.DEACTIVATED:
            if (!reactivate)
                throw ApiError.forbidden(ERROR_CODES.ACCOUNT_DEACTIVATED);
            return { audit: AUDIT_ACTIONS.USER_REACTIVATED, now };
        case USER_STATUSES.PENDING_DELETION:
            return { audit: AUDIT_ACTIONS.DELETION_CANCELLED, now };
        default:
            throw invalidCredentials();
    }
}

/** Sets the account active again and audits `USER_REACTIVATED` or `DELETION_CANCELLED`. */
export async function applyReactivation({ user, change }) {
    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                status: USER_STATUSES.ACTIVE,
                deactivatedAt: null,
                deletionScheduledAt: null,
            },
        }
    );
    await appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action: change.audit,
            entityType: "user",
            entityId: user._id,
        },
        { now: change.now }
    );
}

/**
 * Password login (AUTH-34..38). Order: shadow-counter lock, user lookup, bcrypt compare (against a dummy hash when the
 * account is missing or has no password), then status. Every credential failure is the same `INVALID_CREDENTIALS`;
 * `ACCOUNT_LOCKED` is decided from the shadow counters alone, so it is identical for real and unknown emails.
 *
 * @param {{ email: string, password: string, rememberMe?: boolean, reactivate?: boolean }} input
 * @param {object} ctx request context (see utils/requestContext.js)
 */
export async function loginWithPassword(
    { email, password, rememberMe = false, reactivate = false },
    ctx,
    now = new Date()
) {
    const emailKey = emailAttemptKey(email, ctx.config);
    const lock = await getActiveLock({ emailKey, ipKey: ctx.ipHash }, now);
    if (lock) throw lockedError(lock);

    const user = await User.findOne({ email: normalizeEmail(email) }).select(
        "+passwordHash"
    );
    const matches = await verifyPassword(password, user?.passwordHash);
    if (!user || !matches) {
        await failAttempt({ user, emailKey, ctx, now });
        throw invalidCredentials();
    }

    // The password was right: forget the failures before any status answer (those are only revealed from here on).
    await clearEmailAttempts(emailKey);
    await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginCount: 0, lockoutCount: 0, lockUntil: null } }
    );
    const change = await checkStatus({ user, reactivate, now });
    if (change) await applyReactivation({ user, change });

    return signInUser({
        user,
        ctx,
        method: SIGN_IN_METHODS.PASSWORD,
        remember: rememberMe,
        reactivate:
            user.status === USER_STATUSES.PENDING_DELETION || Boolean(change),
        now,
    });
}
