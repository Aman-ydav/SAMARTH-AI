import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { ROLES } from "#constants/roles.js";
import { AUTH_PROVIDERS, USER_STATUSES } from "#constants/statuses.js";
import { AUTH_TOKEN_TTL_MS, AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { normalizeEmail } from "#utils/strings.js";
import { FRONTEND_PATHS, POLICY_VERSION } from "./auth.constants.js";
import { assertEmailDomainAllowed } from "./domainPolicy.service.js";
import { assertPasswordPolicy, hashPassword } from "./password.service.js";
import { issueEmailToken } from "./tokens.service.js";

/** "30 minutes", "24 hours", "7 days": the lifetime wording used in verification, reset, invite and email-change mails. */
export function describeTtl(type) {
    const minutes = AUTH_TOKEN_TTL_MS[type] / 60_000;
    if (minutes >= 2880 && minutes % 1440 === 0)
        return `${minutes / 1440} days`;
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hours`;
    return `${minutes} minutes`;
}

/** Sends the verification mail for an already-issued token (the link carries it in the fragment, R2). */
export function sendVerificationEmail({ user, token, ctx }) {
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.VERIFY_EMAIL,
        lang: user.locale,
        data: {
            name: user.name,
            link: buildFrontendLink(
                FRONTEND_PATHS.VERIFY_EMAIL,
                { token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(AUTH_TOKEN_TYPES.EMAIL_VERIFY),
        },
    });
}

function sendAlreadyRegistered({ user, ctx }) {
    const base = ctx.config.frontendUrl;
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.ALREADY_REGISTERED,
        lang: user.locale,
        data: {
            name: user.name,
            loginLink: buildFrontendLink(FRONTEND_PATHS.LOGIN, {}, base),
            resetLink: buildFrontendLink(
                FRONTEND_PATHS.FORGOT_PASSWORD,
                {},
                base
            ),
        },
    });
}

async function createPendingUser({ input, email, passwordHash, ctx, now }) {
    return withTransaction(async (session) => {
        const [user] = await User.create(
            [
                {
                    orgId: DEFAULT_ORG_ID,
                    email,
                    name: input.name,
                    passwordHash,
                    passwordChangedAt: now,
                    role: ROLES.LEARNER,
                    status: USER_STATUSES.PENDING_VERIFICATION,
                    authProviders: [AUTH_PROVIDERS.LOCAL],
                    termsAcceptedAt: now,
                    policyVersion: POLICY_VERSION,
                },
            ],
            { session }
        );
        const { token } = await issueEmailToken(
            {
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
                userId: user._id,
                orgId: user.orgId,
                email,
                ctx,
            },
            { session, now }
        );
        await appendAudit(
            {
                actorId: user._id,
                orgId: user.orgId,
                action: AUDIT_ACTIONS.USER_REGISTERED,
                entityType: "user",
                entityId: user._id,
                meta: { provider: AUTH_PROVIDERS.LOCAL },
            },
            { session, now }
        );
        return { user, token };
    });
}

// A pending (unverified) registration is overwritten by the newest submission: only the mailbox owner can verify it, so
// nobody can lock an address by pre-registering it with their own password.
async function refreshPendingUser({ user, input, passwordHash, ctx, now }) {
    return withTransaction(async (session) => {
        const updated = await User.findOneAndUpdate(
            { _id: user._id, status: USER_STATUSES.PENDING_VERIFICATION },
            {
                $set: {
                    name: input.name,
                    passwordHash,
                    passwordChangedAt: now,
                    termsAcceptedAt: now,
                    policyVersion: POLICY_VERSION,
                },
            },
            { session, returnDocument: "after" }
        );
        if (!updated) return null;
        const { token } = await issueEmailToken(
            {
                type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
                userId: user._id,
                orgId: user.orgId,
                email: user.email,
                ctx,
            },
            { session, now }
        );
        return { user: updated, token };
    });
}

async function registerExisting({ email, input, passwordHash, ctx, now }) {
    const user = await User.findOne({ email });
    if (!user) return;
    if (user.status === USER_STATUSES.PENDING_VERIFICATION) {
        const refreshed = await refreshPendingUser({
            user,
            input,
            passwordHash,
            ctx,
            now,
        });
        if (refreshed) {
            sendVerificationEmail({ ...refreshed, ctx });
            return;
        }
    }
    sendAlreadyRegistered({ user, ctx });
}

/**
 * Self-registration (AUTH-26..28). The caller always answers `202` with one fixed message: a new address, an address that
 * already has an account and a pending address are indistinguishable. The password is hashed in every case so the time
 * spent does not depend on whether the address exists. The role is always `learner`.
 *
 * @param {{ name: string, email: string, password: string, acceptTerms: true }} input
 * @param {object} ctx request context
 */
export async function registerUser(input, ctx, now = new Date()) {
    if (!ctx.config.auth.allowSelfRegistration) {
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
            message: "Self-registration is disabled.",
        });
    }
    const email = normalizeEmail(input.email);
    assertEmailDomainAllowed(email, ctx.config);
    assertPasswordPolicy(input.password, { email, name: input.name });
    const passwordHash = await hashPassword(input.password);

    const existing = await User.exists({ email });
    if (existing)
        return registerExisting({ email, input, passwordHash, ctx, now });
    try {
        const created = await createPendingUser({
            input,
            email,
            passwordHash,
            ctx,
            now,
        });
        sendVerificationEmail({ ...created, ctx });
    } catch (error) {
        // Two registrations for one new address raced: the unique index decided, the loser takes the "exists" path.
        if (error?.code !== 11000) throw error;
        await registerExisting({ email, input, passwordHash, ctx, now });
    }
    return undefined;
}
