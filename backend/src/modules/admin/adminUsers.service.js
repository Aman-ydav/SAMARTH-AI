import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ROLES } from "#constants/roles.js";
import { SESSION_REVOKED_REASONS, USER_STATUSES } from "#constants/statuses.js";
import { withTransaction } from "#db/transaction.js";
import { appendAudit } from "#modules/audit/index.js";
import { revokeAllSessions } from "#modules/auth/index.js";
import { assertNotLastAdmin, User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { escapeRegex, toObjectId } from "#utils/mongo.js";
import { noneOf } from "#utils/mongoOps.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { normalizeEmail } from "#utils/strings.js";
import {
    ASSIGNABLE_ROLES,
    STATUS_TARGETS,
    USER_SORT_FIELDS,
} from "./admin.constants.js";

// Only these fields leave the service (BE-47). Secret fields are `select: false` as well, so they can never be loaded here.
const LIST_FIELDS =
    "email name role status emailVerified authProviders mustChangePassword lastLoginAt createdAt";

/** The user as the admin API shows it: an allow-list, never a hash, token version, device list or lock counters. */
export function toAdminUser(user) {
    const plain = typeof user.toObject === "function" ? user.toObject() : user;
    return {
        id: String(plain._id ?? plain.id),
        email: plain.email,
        name: plain.name,
        role: plain.role,
        status: plain.status,
        emailVerified: Boolean(plain.emailVerified),
        authProviders: [...(plain.authProviders ?? [])],
        mustChangePassword: Boolean(plain.mustChangePassword),
        lastLoginAt: plain.lastLoginAt ?? null,
        createdAt: plain.createdAt,
    };
}

const isPlatformAdmin = (actor) => actor.role === ROLES.SUPERADMIN;

// Platform admins are internal accounts: org admins neither see them in lists nor reach them by id (404).
const hiddenFromActor = (actor) =>
    isPlatformAdmin(actor) ? {} : { role: noneOf([ROLES.SUPERADMIN]) };

function assertAdminArea(actor) {
    if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role))
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
}

/**
 * Lists the users of the actor's org (page, limit, sort, order; filters `role`, `status`; `q` = anchored, escaped,
 * lower-cased email prefix). A plain bounded query on `{ orgId, ... }` with the `users_*` indexes: one collection, no
 * joins, so no aggregation is needed yet (DB-51). Platform admins are left out for everyone but a platform admin.
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listUsers(actor, query = {}) {
    assertAdminArea(actor);
    const page = parsePagination(query, {
        allowedSort: USER_SORT_FIELDS,
        defaultSort: "createdAt",
        defaultOrder: "desc",
    });
    if (!isPlatformAdmin(actor) && query.role === ROLES.SUPERADMIN) {
        return {
            items: [],
            meta: buildPageMeta({
                page: page.page,
                limit: page.limit,
                total: 0,
            }),
        };
    }
    const filter = {
        orgId: actor.orgId,
        ...hiddenFromActor(actor),
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        // A RegExp value is not an operator object, so sanitizeFilter leaves it alone (BE-62).
        ...(query.q
            ? { email: new RegExp(`^${escapeRegex(normalizeEmail(query.q))}`) }
            : {}),
    };
    const [rows, total] = await Promise.all([
        User.find(filter)
            .sort(page.sort)
            .skip(page.skip)
            .limit(page.limit)
            .select(LIST_FIELDS)
            .lean(),
        User.countDocuments(filter),
    ]);
    return {
        items: rows.map(toAdminUser),
        meta: buildPageMeta({ page: page.page, limit: page.limit, total }),
    };
}

// A missing user, one of another org and (for an org admin) a platform admin are all 404 (BE-42, AUTH-62).
async function loadTarget(actor, id, session) {
    const target = await User.findOne({
        _id: toObjectId(id),
        orgId: actor.orgId,
        ...hiddenFromActor(actor),
    }).session(session ?? null);
    if (!target) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    return target;
}

function assertNotSelf(actor, target) {
    if (String(target._id) === String(actor.userId))
        throw ApiError.forbidden(ERROR_CODES.SELF_ACTION_FORBIDDEN);
}

const audit = (actor, target, action, meta, session, now) =>
    appendAudit(
        {
            actorId: actor.userId,
            orgId: actor.orgId,
            action,
            entityType: "user",
            entityId: target._id,
            meta,
        },
        { session, now }
    );

/**
 * Suspends (`active` to `suspended`) or reactivates (`suspended` to `active`) an account. An admin may act on learners and
 * trainers, a platform admin also on admins; nobody acts on themselves or on a platform admin. Suspending bumps
 * `tokenVersion` and revokes every session in the same transaction, so the person is signed out at once. Any other state
 * change is a 409 `CONFLICT`. Audits `USER_SUSPENDED` / `USER_REACTIVATED`.
 * @returns {Promise<object>} the admin view of the updated user
 */
export async function setUserStatus(actor, id, status, now = new Date()) {
    assertAdminArea(actor);
    const suspending = status === USER_STATUSES.SUSPENDED;
    const from = suspending ? USER_STATUSES.ACTIVE : USER_STATUSES.SUSPENDED;
    return withTransaction(async (session) => {
        const target = await loadTarget(actor, id, session);
        assertNotSelf(actor, target);
        if (!STATUS_TARGETS[actor.role].includes(target.role)) {
            throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
                message: "You cannot manage this account.",
            });
        }
        if (target.status !== from)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (suspending) await assertNotLastAdmin(target, { session });
        const updated = await User.findOneAndUpdate(
            { _id: target._id, orgId: actor.orgId, status: from },
            {
                $set: {
                    status,
                    ...(suspending
                        ? {}
                        : {
                              failedLoginCount: 0,
                              lockoutCount: 0,
                              lockUntil: null,
                          }),
                },
                ...(suspending ? { $inc: { tokenVersion: 1 } } : {}),
            },
            { session, returnDocument: "after", runValidators: true }
        );
        if (!updated) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (suspending) {
            await revokeAllSessions(target._id, SESSION_REVOKED_REASONS.ADMIN, {
                session,
                now,
            });
        }
        await audit(
            actor,
            target,
            suspending
                ? AUDIT_ACTIONS.USER_SUSPENDED
                : AUDIT_ACTIONS.USER_REACTIVATED,
            { role: target.role },
            session,
            now
        );
        return toAdminUser(updated);
    });
}

/**
 * Changes a role between learner, trainer and admin (platform admin only, AUTH-61). Never on oneself, never to or from
 * `superadmin`, never a no-op; demoting an admin keeps the last-admin guard. The change bumps `tokenVersion` and revokes
 * every session of the person so the new role applies on the next sign-in. Audits `ROLE_CHANGED`.
 * @returns {Promise<object>} the admin view of the updated user
 */
export async function changeUserRole(actor, id, role, now = new Date()) {
    if (!isPlatformAdmin(actor))
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
    if (!ASSIGNABLE_ROLES.includes(role)) {
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
            message: "You cannot grant this role.",
        });
    }
    return withTransaction(async (session) => {
        const target = await loadTarget(actor, id, session);
        assertNotSelf(actor, target);
        if (target.role === ROLES.SUPERADMIN) {
            throw ApiError.forbidden(ERROR_CODES.FORBIDDEN, {
                message: "A platform admin role cannot be changed here.",
            });
        }
        if (target.role === role) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (target.role === ROLES.ADMIN)
            await assertNotLastAdmin(target, { session });
        const updated = await User.findOneAndUpdate(
            { _id: target._id, orgId: actor.orgId, role: target.role },
            { $set: { role }, $inc: { tokenVersion: 1 } },
            { session, returnDocument: "after", runValidators: true }
        );
        if (!updated) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        await revokeAllSessions(target._id, SESSION_REVOKED_REASONS.ADMIN, {
            session,
            now,
        });
        await audit(
            actor,
            target,
            AUDIT_ACTIONS.ROLE_CHANGED,
            { from: target.role, to: role },
            session,
            now
        );
        return toAdminUser(updated);
    });
}
