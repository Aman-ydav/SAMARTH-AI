import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { ROLES } from "#constants/roles.js";
import { AUTH_PROVIDERS, USER_STATUSES } from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { appendAudit } from "#modules/audit/index.js";
import { toAuthUser, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { FRONTEND_PATHS, POLICY_VERSION } from "./auth.constants.js";
import { assertEmailDomainAllowed } from "./domainPolicy.service.js";
import { applyReactivation, checkStatus } from "./login.service.js";
import { reauthenticate } from "./reauth.service.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";
import { supersedeEmailTokens } from "./tokens.service.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";

const audit = (user, action, meta, now) =>
    appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action,
            entityType: "user",
            entityId: user._id,
            meta,
        },
        { now }
    );

// Same email, VERIFIED local account: the Google identity is attached to it (AUTH-43).
async function linkToVerifiedAccount({ user, profile, ctx, now }) {
    await User.updateOne(
        { _id: user._id },
        {
            $set: { googleSub: profile.sub },
            $addToSet: { authProviders: AUTH_PROVIDERS.GOOGLE },
        }
    );
    await audit(user, AUDIT_ACTIONS.GOOGLE_LINKED, { mode: "linked" }, now);
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.GOOGLE_LINKED,
        lang: user.locale,
        data: { name: user.name, at: now.toISOString() },
    });
}

// Same email, UNVERIFIED local account: never linked. Its password and pending verification are wiped and the account
// becomes a Google-only account, so whoever pre-registered the address with a password gains nothing (AUTH-43).
async function replaceUnverifiedAccount({ user, profile, now }) {
    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                googleSub: profile.sub,
                authProviders: [AUTH_PROVIDERS.GOOGLE],
                passwordHistory: [],
                emailVerified: true,
                emailVerifiedAt: now,
                status: USER_STATUSES.ACTIVE,
                name: profile.name,
                mustChangePassword: false,
            },
            $unset: { passwordHash: 1, passwordChangedAt: 1 },
        }
    );
    await supersedeEmailTokens(
        { userId: user._id, type: AUTH_TOKEN_TYPES.EMAIL_VERIFY },
        { now }
    );
    await audit(
        user,
        AUDIT_ACTIONS.GOOGLE_LINKED,
        { mode: "replaced_unverified" },
        now
    );
}

async function createGoogleUser({ profile, ctx, now }) {
    assertEmailDomainAllowed(profile.email, ctx.config);
    const user = await User.create({
        orgId: DEFAULT_ORG_ID,
        email: profile.email,
        name: profile.name,
        googleSub: profile.sub,
        authProviders: [AUTH_PROVIDERS.GOOGLE],
        role: ROLES.LEARNER,
        status: USER_STATUSES.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        policyVersion: POLICY_VERSION,
    });
    await audit(
        user,
        AUDIT_ACTIONS.USER_REGISTERED,
        { provider: AUTH_PROVIDERS.GOOGLE },
        now
    );
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
    return user;
}

// Finds the account for a verified Google profile: by `sub` first (emails change), then by email (AUTH-42, AUTH-43).
async function resolveAccount({ profile, ctx, now }) {
    const bySub = await User.findOne({ googleSub: profile.sub });
    if (bySub) return { user: bySub, created: false };
    const byEmail = await User.findOne({ email: profile.email });
    if (!byEmail)
        return {
            user: await createGoogleUser({ profile, ctx, now }),
            created: true,
        };
    if (byEmail.emailVerified) {
        await linkToVerifiedAccount({ user: byEmail, profile, ctx, now });
        return { user: byEmail, created: false };
    }
    await replaceUnverifiedAccount({ user: byEmail, profile, now });
    return { user: await User.findById(byEmail._id), created: true };
}

/**
 * Google sign-in (AUTH-41..45, doc 20 section 5). The credential is verified server side by the injected verifier
 * (`ctx.verifyGoogleCredential`); only its `sub`, verified `email` and `name` are used. Then the same status gate,
 * session and new-device logic as password login applies.
 *
 * @param {{ credential: string, nonce?: string, reactivate?: boolean }} input
 * @param {object} ctx request context
 */
export async function googleSignIn(
    { credential, nonce, reactivate = false },
    ctx,
    now = new Date()
) {
    if (!ctx.config.auth.allowGoogleLogin) {
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
            message: "Google sign-in is disabled.",
        });
    }
    const profile = await ctx.verifyGoogleCredential(credential, { nonce });
    const { user, created } = await resolveAccount({ profile, ctx, now });
    const change = await checkStatus({ user, reactivate, now });
    if (change) await applyReactivation({ user, change });
    return signInUser({
        user,
        ctx,
        method: SIGN_IN_METHODS.GOOGLE,
        notifyDevice: !created,
        reactivate: Boolean(change),
        now,
    });
}

/**
 * Unlinks Google (`DELETE /auth/google`, R38). Needs a fresh Google credential for the linked account, and is refused
 * with `AUTH_METHOD_REQUIRED` when Google is the only way to sign in (AUTH-44).
 */
export async function unlinkGoogle(
    { userId, credential },
    ctx,
    now = new Date()
) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    if (!user.googleSub)
        throw ApiError.conflict(ERROR_CODES.CONFLICT, {
            message: "Google is not linked.",
        });
    await reauthenticate({ user, credential }, ctx);
    if (!user.passwordHash)
        throw ApiError.conflict(ERROR_CODES.AUTH_METHOD_REQUIRED);
    const updated = await User.findByIdAndUpdate(
        user._id,
        {
            $unset: { googleSub: 1 },
            $pull: { authProviders: AUTH_PROVIDERS.GOOGLE },
        },
        { returnDocument: "after" }
    ).select("+passwordHash");
    await audit(user, AUDIT_ACTIONS.GOOGLE_UNLINKED, {}, now);
    return toAuthUser(updated);
}
