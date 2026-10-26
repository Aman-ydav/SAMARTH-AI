import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import {
    AUTH_PROVIDERS,
    SESSION_REVOKED_REASONS,
    USER_STATUSES,
} from "#constants/statuses.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import {
    assertNotLastAdmin,
    needsOnboarding,
    toAuthUser,
    User,
} from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { addMs } from "#utils/dates.js";
import { DELETION_GRACE_MS, FRONTEND_PATHS } from "./auth.constants.js";
import {
    assertNotReused,
    assertPasswordPolicy,
    hashPassword,
    nextPasswordHistory,
} from "./password.service.js";
import { reauthenticate } from "./reauth.service.js";
import { findLiveFamily, revokeAllSessions } from "./session.service.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";
import { createAccessToken, generateCsrfToken } from "./tokens.service.js";

const userAudit = (user, action, meta, session, now) =>
    appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action,
            entityType: "user",
            entityId: user._id,
            meta,
        },
        { session, now }
    );

async function loadUserOrFail(userId) {
    const user = await User.findById(userId).select(
        "+passwordHash +passwordHistory"
    );
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return user;
}

/**
 * Change password / set a password on a Google-only account (doc 08 #15, AUTH-25, AUTH-55). Needs the current password
 * (or a fresh Google credential); the new password must pass the policy and differ from the current and last three.
 * It bumps `tokenVersion`, revokes every OTHER session, keeps the history and mails the owner.
 *
 * Returns the same shape as a login so the controller can re-issue cookies: the current session keeps its refresh
 * token (only a new access token and csrf value are issued); a limited must-change-password session becomes a normal one.
 */
export async function changePassword(
    { userId, sid, currentPassword, credential, newPassword },
    ctx,
    now = new Date()
) {
    const user = await loadUserOrFail(userId);
    await reauthenticate({ user, currentPassword, credential }, ctx);
    assertPasswordPolicy(
        newPassword,
        { email: user.email, name: user.name },
        "newPassword"
    );
    await assertNotReused(newPassword, user);
    const passwordHash = await hashPassword(newPassword);

    const updated = await withTransaction(async (session) => {
        const changed = await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    passwordHash,
                    passwordChangedAt: now,
                    passwordHistory: nextPasswordHistory(
                        user.passwordHash,
                        user.passwordHistory
                    ),
                    mustChangePassword: false,
                },
                $inc: { tokenVersion: 1 },
                $addToSet: { authProviders: AUTH_PROVIDERS.LOCAL },
            },
            { session, returnDocument: "after" }
        );
        await revokeAllSessions(
            user._id,
            SESSION_REVOKED_REASONS.PASSWORD_CHANGE,
            {
                exceptFamilyId: sid ?? undefined,
                session,
                now,
            }
        );
        await userAudit(
            user,
            AUDIT_ACTIONS.PASSWORD_CHANGED,
            { method: "change" },
            session,
            now
        );
        return changed;
    });

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
    if (!sid) {
        return signInUser({
            user: updated,
            ctx,
            method: SIGN_IN_METHODS.PASSWORD,
            notifyDevice: false,
            now,
        });
    }
    const live = await findLiveFamily(sid, user._id, now);
    return {
        user: toAuthUser(updated, { hasPassword: true }),
        needsOnboarding: needsOnboarding(updated),
        reactivate: false,
        session: {
            accessToken: createAccessToken(updated, sid, ctx.config),
            csrfToken: generateCsrfToken(),
            remember: Boolean(live?.remember),
        },
    };
}

/**
 * Deletes the account after the grace period (doc 08 #21, AUTH-56): re-auth, refuse for the last active admin, revoke
 * all sessions, status `pending_deletion` for 30 days (logging in cancels it, R18). Anonymising is the later job's work.
 */
export async function deleteAccount(
    { userId, currentPassword, credential },
    ctx,
    now = new Date()
) {
    const user = await loadUserOrFail(userId);
    await reauthenticate({ user, currentPassword, credential }, ctx);
    await assertNotLastAdmin(user);
    const graceEndsAt = addMs(now, DELETION_GRACE_MS);

    await withTransaction(async (session) => {
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    status: USER_STATUSES.PENDING_DELETION,
                    deletionScheduledAt: graceEndsAt,
                },
                $inc: { tokenVersion: 1 },
            },
            { session }
        );
        await revokeAllSessions(user._id, SESSION_REVOKED_REASONS.LOGOUT_ALL, {
            session,
            now,
        });
        await userAudit(
            user,
            AUDIT_ACTIONS.DELETION_REQUESTED,
            { graceEndsAt: graceEndsAt.toISOString() },
            session,
            now
        );
    });
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.DELETION_SCHEDULED,
        lang: user.locale,
        data: {
            name: user.name,
            graceEndsAt: graceEndsAt.toISOString(),
            link: buildFrontendLink(
                FRONTEND_PATHS.LOGIN,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
    return { graceEndsAt };
}
