import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { INVITABLE_ROLES, ROLE_LIST, ROLES } from "#constants/roles.js";
import {
    AUTH_PROVIDERS,
    INVITE_STATUSES,
    USER_STATUSES,
} from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { Invite, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { gt } from "#utils/mongoOps.js";
import { normalizeEmail } from "#utils/strings.js";
import { FRONTEND_PATHS, POLICY_VERSION } from "./auth.constants.js";
import { assertEmailDomainAllowed } from "./domainPolicy.service.js";
import { assertPasswordPolicy, hashPassword } from "./password.service.js";
import { describeTtl } from "./register.service.js";
import { SIGN_IN_METHODS, signInUser } from "./signIn.service.js";
import {
    consumeEmailToken,
    issueEmailToken,
    peekEmailToken,
} from "./tokens.service.js";

const TYPE = AUTH_TOKEN_TYPES.INVITE;
const ORG_LABEL = "SAMARTH AI";
const invalidInvite = () => ApiError.badRequest(ERROR_CODES.INVITE_INVALID);

// No implicit hierarchy anywhere else (AUTH-60), but an invite may never grant more than the inviter holds (AUTH-61).
const RANK = Object.freeze(
    Object.fromEntries(ROLE_LIST.map((role, index) => [role, index]))
);

/**
 * Creates an invite and mails the link (doc 20 section 8). Called by the admin module; it enforces the role rules itself:
 * only admins and superadmins invite, `superadmin` is never invitable, and nobody can grant a role above their own.
 *
 * @param {{ email: string, role: string, departmentId?: string }} input
 * @param {{ userId: string, role: string, orgId: string }} actor the signed-in inviter (from `req.auth`)
 */
export async function createInvite(
    { email, role, departmentId },
    actor,
    ctx,
    now = new Date()
) {
    if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
    }
    if (!INVITABLE_ROLES.includes(role) || RANK[role] > RANK[actor.role]) {
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
            message: "You cannot grant this role.",
        });
    }
    const address = normalizeEmail(email);
    assertEmailDomainAllowed(address, ctx.config);
    const clash = await Promise.all([
        User.exists({ email: address }),
        Invite.exists({
            orgId: actor.orgId,
            email: address,
            status: INVITE_STATUSES.SENT,
        }),
    ]);
    if (clash.some(Boolean)) throw ApiError.conflict(ERROR_CODES.CONFLICT);

    const inviter = await User.findById(actor.userId)
        .select("name locale")
        .lean();
    const { invite, token } = await withTransaction(async (session) => {
        const issued = await issueEmailToken(
            {
                type: TYPE,
                email: address,
                orgId: actor.orgId,
                meta: { role, orgId: actor.orgId },
                ctx,
                supersede: false,
            },
            { session, now }
        );
        const [created] = await Invite.create(
            [
                {
                    orgId: actor.orgId,
                    email: address,
                    role,
                    departmentId,
                    invitedBy: actor.userId,
                    tokenId: issued.record._id,
                    expiresAt: issued.record.expiresAt,
                },
            ],
            { session }
        );
        await appendAudit(
            {
                actorId: actor.userId,
                orgId: actor.orgId,
                action: AUDIT_ACTIONS.INVITE_SENT,
                entityType: "invite",
                entityId: created._id,
                meta: { role },
            },
            { session, now }
        );
        return { invite: created, token: issued.token };
    });
    ctx.mail({
        to: address,
        templateKey: EMAIL_TEMPLATES.INVITE,
        data: {
            inviterName: inviter?.name ?? ORG_LABEL,
            orgName: ORG_LABEL,
            role,
            link: buildFrontendLink(
                FRONTEND_PATHS.ACCEPT_INVITE,
                { token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(TYPE),
        },
    });
    return invite;
}

/**
 * Accepts an invite (doc 08 #22): the password and domain policy are checked first, then one transaction consumes the
 * token, finds the still-open invite, creates the active, verified user with the invited role and marks the invite
 * accepted. Expired, used, revoked, unknown or already-registered: `INVITE_INVALID`. Starts a session.
 */
export async function acceptInvite(
    { token, name, password },
    ctx,
    now = new Date()
) {
    const peeked = await peekEmailToken({ token, type: TYPE }, { now });
    if (!peeked) throw invalidInvite();
    assertEmailDomainAllowed(peeked.email, ctx.config);
    assertPasswordPolicy(password, { email: peeked.email, name });
    const passwordHash = await hashPassword(password);

    const user = await withTransaction(async (session) => {
        const record = await consumeEmailToken(
            { token, type: TYPE },
            { session, now }
        );
        if (!record) throw invalidInvite();
        const invite = await Invite.findOne({
            tokenId: record._id,
            status: INVITE_STATUSES.SENT,
            expiresAt: gt(now),
        }).session(session);
        if (
            !invite ||
            (await User.exists({ email: invite.email }).session(session))
        ) {
            throw invalidInvite();
        }
        const [created] = await User.create(
            [
                {
                    orgId: invite.orgId,
                    email: invite.email,
                    name,
                    passwordHash,
                    passwordChangedAt: now,
                    role: invite.role,
                    status: USER_STATUSES.ACTIVE,
                    emailVerified: true,
                    emailVerifiedAt: now,
                    authProviders: [AUTH_PROVIDERS.LOCAL],
                    termsAcceptedAt: now,
                    policyVersion: POLICY_VERSION,
                },
            ],
            { session }
        );
        invite.status = INVITE_STATUSES.ACCEPTED;
        invite.acceptedAt = now;
        await invite.save({ session });
        await appendAudit(
            {
                actorId: created._id,
                orgId: created.orgId,
                action: AUDIT_ACTIONS.INVITE_ACCEPTED,
                entityType: "invite",
                entityId: invite._id,
                meta: { role: invite.role },
            },
            { session, now }
        );
        return created;
    });
    return signInUser({
        user,
        ctx,
        method: SIGN_IN_METHODS.INVITE,
        notifyDevice: false,
        now,
    });
}
