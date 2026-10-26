import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { appendAudit } from "#modules/audit/index.js";
import { needsOnboarding, toAuthUser, User } from "#modules/users/index.js";
import { handleDevice } from "./device.service.js";
import { createSession } from "./session.service.js";
import { createAccessToken, generateCsrfToken } from "./tokens.service.js";

export const SIGN_IN_METHODS = Object.freeze({
    PASSWORD: "password",
    GOOGLE: "google",
    VERIFY_EMAIL: "verify_email",
    INVITE: "invite",
});

/**
 * Finishes a successful authentication, whatever proved it (password, Google, email verification, invite):
 * records `lastLoginAt`, audits `LOGIN_SUCCESS`, and creates the credentials the controller turns into cookies.
 *
 * - Normal user: a refresh session is created and the device is checked (the "new sign-in" mail, AUTH-39). Pass
 *   `notifyDevice: false` for the first session of a freshly created or verified account, which only seeds the list.
 * - `mustChangePassword` user: a limited session, only a 15-minute access token and NO refresh token (AUTH-38, R39).
 *
 * Returns `{ user, needsOnboarding, reactivate, session }`. `session` is `{ accessToken, refreshToken?, csrfToken,
 * remember }` and must go to `cookies.setSessionCookies`; it never appears in the response body (AUTH-37).
 */
export async function signInUser({
    user,
    ctx,
    method = SIGN_IN_METHODS.PASSWORD,
    remember = false,
    notifyDevice = true,
    reactivate = false,
    now = new Date(),
}) {
    const limited = Boolean(user.mustChangePassword);
    let session;
    if (limited) {
        session = {
            accessToken: createAccessToken(user, null, ctx.config),
            csrfToken: generateCsrfToken(),
            remember: false,
        };
    } else {
        const created = await createSession({ user, ctx, remember, now });
        await handleDevice({ user, ctx, notify: notifyDevice, now });
        session = {
            accessToken: createAccessToken(user, created.familyId, ctx.config),
            refreshToken: created.refreshToken,
            csrfToken: generateCsrfToken(),
            remember,
        };
    }
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
    await appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action: AUDIT_ACTIONS.LOGIN_SUCCESS,
            entityType: "user",
            entityId: user._id,
            meta: { method, limited, remember },
        },
        { now }
    );
    const fresh = await User.findById(user._id).select("+passwordHash").lean();
    return {
        user: toAuthUser(fresh),
        needsOnboarding: needsOnboarding(fresh),
        reactivate,
        session,
    };
}
