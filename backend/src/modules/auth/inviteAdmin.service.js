import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { INVITE_GRANTS, ROLES } from "#constants/roles.js";
import { INVITE_STATUSES } from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { Invite, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { anyOf, gt, lte } from "#utils/mongoOps.js";
import { toObjectId } from "#utils/mongo.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { FRONTEND_PATHS } from "./auth.constants.js";
import { AuthToken } from "./authToken.model.js";
import { assertEmailDomainAllowed } from "./domainPolicy.service.js";
import { describeTtl } from "./register.service.js";
import { issueEmailToken } from "./tokens.service.js";

const TYPE = AUTH_TOKEN_TYPES.INVITE;
const ORG_LABEL = "SAMARTH AI";
/** Resends allowed per invite (rule 05, invites `resentCount` max 5). */
export const MAX_INVITE_RESENDS = 5;
export const INVITE_SORT_FIELDS = Object.freeze(["createdAt", "email"]);

/**
 * The invite as the API shows it (BE-47): an explicit allow-list, never the token id. A `sent` invite past its 7 days is
 * reported as `expired`, because nothing flips the stored status when the time passes.
 */
export function toInviteView(invite, now = new Date()) {
    const plain =
        typeof invite.toObject === "function" ? invite.toObject() : invite;
    const lapsed =
        plain.status === INVITE_STATUSES.SENT &&
        new Date(plain.expiresAt) <= now;
    return {
        id: String(plain._id ?? plain.id),
        email: plain.email,
        role: plain.role,
        status: lapsed ? INVITE_STATUSES.EXPIRED : plain.status,
        departmentId: plain.departmentId ? String(plain.departmentId) : null,
        invitedBy: String(plain.invitedBy),
        resentCount: plain.resentCount ?? 0,
        expiresAt: plain.expiresAt,
        acceptedAt: plain.acceptedAt ?? null,
        createdAt: plain.createdAt,
    };
}

// Which stored rows a status filter means: `sent` is still open, `expired` also covers open rows that have lapsed.
function statusFilter(status, now) {
    if (!status) return {};
    if (status === INVITE_STATUSES.SENT) return { status, expiresAt: gt(now) };
    if (status === INVITE_STATUSES.EXPIRED) {
        return {
            $or: [
                { status: INVITE_STATUSES.EXPIRED },
                { status: INVITE_STATUSES.SENT, expiresAt: lte(now) },
            ],
        };
    }
    return { status };
}

function grantsOf(actor) {
    const grants = INVITE_GRANTS[actor.role];
    if (!grants) throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
    return grants;
}

/**
 * Lists the invites of the actor's org (page, limit, sort, order, optional status). A platform admin sees them all; an
 * admin sees only the roles an admin can invite (trainers), so admin invites stay out of their view.
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listInvites(actor, query = {}, now = new Date()) {
    const grants = grantsOf(actor);
    const page = parsePagination(query, {
        allowedSort: INVITE_SORT_FIELDS,
        defaultSort: "createdAt",
        defaultOrder: "desc",
    });
    const filter = {
        orgId: actor.orgId,
        ...(actor.role === ROLES.SUPERADMIN ? {} : { role: anyOf(grants) }),
        ...statusFilter(query.status, now),
    };
    const [rows, total] = await Promise.all([
        Invite.find(filter)
            .sort(page.sort)
            .skip(page.skip)
            .limit(page.limit)
            .select("-tokenId")
            .lean(),
        Invite.countDocuments(filter),
    ]);
    return {
        items: rows.map((row) => toInviteView(row, now)),
        meta: buildPageMeta({ page: page.page, limit: page.limit, total }),
    };
}

// An invite of another org, a missing one and one outside the actor's grantable roles are all 404 (BE-42, AUTH-62).
async function loadManageable(actor, id, session) {
    const grants = grantsOf(actor);
    const invite = await Invite.findOne({
        _id: toObjectId(id),
        orgId: actor.orgId,
    }).session(session ?? null);
    if (!invite || !grants.includes(invite.role))
        throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return invite;
}

const expireToken = (tokenId, session, now) =>
    AuthToken.updateOne(
        { _id: tokenId, usedAt: null },
        { $set: { expiresAt: now } },
        { session }
    );

/**
 * Revokes an open invite: the row becomes `revoked` and its token is expired at once, so the emailed link stops working
 * (accept answers `INVITE_INVALID`). An accepted or already revoked invite is 409. Audits `INVITE_REVOKED`.
 * @returns {Promise<object>} the invite view
 */
export async function revokeInvite(actor, id, now = new Date()) {
    const updated = await withTransaction(async (session) => {
        const invite = await loadManageable(actor, id, session);
        const result = await Invite.updateOne(
            { _id: invite._id, status: INVITE_STATUSES.SENT },
            { $set: { status: INVITE_STATUSES.REVOKED } },
            { session }
        );
        if (result.modifiedCount !== 1)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        await expireToken(invite.tokenId, session, now);
        await appendAudit(
            {
                actorId: actor.userId,
                orgId: actor.orgId,
                action: AUDIT_ACTIONS.INVITE_REVOKED,
                entityType: "invite",
                entityId: invite._id,
                meta: { role: invite.role },
            },
            { session, now }
        );
        return { ...invite.toObject(), status: INVITE_STATUSES.REVOKED };
    });
    return toInviteView(updated, now);
}

/**
 * Resends an open (or lapsed) invite: the old token is expired, a new one is issued with a fresh 7 days, the mail goes out
 * again and `resentCount` goes up (at most 5, else 422 `UNPROCESSABLE`). Accepted and revoked invites are 409. Audits
 * `INVITE_RESENT`.
 * @returns {Promise<object>} the invite view
 */
export async function resendInvite(actor, id, ctx, now = new Date()) {
    const inviter = await User.findById(actor.userId).select("name").lean();
    const { invite, token } = await withTransaction(async (session) => {
        const current = await loadManageable(actor, id, session);
        if (current.status !== INVITE_STATUSES.SENT)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (current.resentCount >= MAX_INVITE_RESENDS) {
            throw ApiError.unprocessable(ERROR_CODES.UNPROCESSABLE, {
                message: "This invitation has been resent too many times.",
            });
        }
        assertEmailDomainAllowed(current.email, ctx.config);
        const issued = await issueEmailToken(
            {
                type: TYPE,
                email: current.email,
                orgId: current.orgId,
                meta: { role: current.role, orgId: String(current.orgId) },
                ctx,
                supersede: false,
            },
            { session, now }
        );
        const result = await Invite.updateOne(
            {
                _id: current._id,
                status: INVITE_STATUSES.SENT,
                tokenId: current.tokenId,
            },
            {
                $set: {
                    tokenId: issued.record._id,
                    expiresAt: issued.record.expiresAt,
                },
                $inc: { resentCount: 1 },
            },
            { session }
        );
        if (result.modifiedCount !== 1)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        await expireToken(current.tokenId, session, now);
        await appendAudit(
            {
                actorId: actor.userId,
                orgId: actor.orgId,
                action: AUDIT_ACTIONS.INVITE_RESENT,
                entityType: "invite",
                entityId: current._id,
                meta: {
                    role: current.role,
                    resentCount: current.resentCount + 1,
                },
            },
            { session, now }
        );
        return {
            invite: {
                ...current.toObject(),
                expiresAt: issued.record.expiresAt,
                resentCount: current.resentCount + 1,
            },
            token: issued.token,
        };
    });
    ctx.mail({
        to: invite.email,
        templateKey: EMAIL_TEMPLATES.INVITE,
        data: {
            inviterName: inviter?.name ?? ORG_LABEL,
            orgName: ORG_LABEL,
            role: invite.role,
            link: buildFrontendLink(
                FRONTEND_PATHS.ACCEPT_INVITE,
                { token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(TYPE),
        },
    });
    return toInviteView(invite, now);
}
