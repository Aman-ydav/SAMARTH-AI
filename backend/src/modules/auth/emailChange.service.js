import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { SESSION_REVOKED_REASONS, USER_STATUSES } from "#constants/statuses.js";
import { AUTH_TOKEN_TYPES, EMAIL_CHANGE_KINDS } from "#constants/tokenTypes.js";
import { withTransaction } from "#db/transaction.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { hmacIdentifier } from "#utils/hash.js";
import { maskEmail, normalizeEmail } from "#utils/strings.js";
import { FRONTEND_PATHS } from "./auth.constants.js";
import { assertEmailDomainAllowed } from "./domainPolicy.service.js";
import { reauthenticate } from "./reauth.service.js";
import { describeTtl } from "./register.service.js";
import { revokeAllSessions } from "./session.service.js";
import {
    consumeEmailToken,
    issueEmailToken,
    supersedeEmailTokens,
} from "./tokens.service.js";

const TYPE = AUTH_TOKEN_TYPES.EMAIL_CHANGE;
const { CONFIRM, UNDO } = EMAIL_CHANGE_KINDS;
const invalidToken = (cause) =>
    ApiError.badRequest(ERROR_CODES.EMAIL_CHANGE_INVALID, { cause });

const hashed = (email, ctx) =>
    hmacIdentifier(email, ctx.config.auth.identifierHashSecret);

function sendUndoNotice({ user, oldEmail, newEmail, token, ctx }) {
    ctx.mail({
        to: oldEmail,
        templateKey: EMAIL_TEMPLATES.EMAIL_CHANGE_NOTICE,
        lang: user.locale,
        data: {
            name: user.name,
            newEmailMasked: maskEmail(newEmail),
            undoLink: buildFrontendLink(
                FRONTEND_PATHS.UNDO_EMAIL_CHANGE,
                { token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(TYPE),
        },
    });
}

/**
 * Starts an email change (doc 08 #16, AUTH-55). Always succeeds with the same neutral answer: an address that is the
 * current one or belongs to someone else simply sends nothing, so nothing leaks. Otherwise the NEW address gets the
 * confirmation link and the OLD address gets a notice with a 24 h undo link. The address only changes on confirm.
 */
export async function requestEmailChange(
    { userId, newEmail, currentPassword, credential },
    ctx,
    now = new Date()
) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
    await reauthenticate({ user, currentPassword, credential }, ctx);
    const target = normalizeEmail(newEmail);
    assertEmailDomainAllowed(target, ctx.config, "newEmail");
    if (target === user.email || (await User.exists({ email: target }))) return;

    const meta = { oldEmail: user.email, newEmail: target };
    const issued = await withTransaction(async (session) => {
        const base = { type: TYPE, userId: user._id, orgId: user.orgId, ctx };
        const confirm = await issueEmailToken(
            { ...base, email: target, meta: { ...meta, kind: CONFIRM } },
            { session, now }
        );
        const undo = await issueEmailToken(
            { ...base, email: user.email, meta: { ...meta, kind: UNDO } },
            { session, now }
        );
        await appendAudit(
            {
                actorId: user._id,
                orgId: user.orgId,
                action: AUDIT_ACTIONS.EMAIL_CHANGE_REQUESTED,
                entityType: "user",
                entityId: user._id,
                meta: { newEmailHash: hashed(target, ctx) },
            },
            { session, now }
        );
        return { confirm, undo };
    });

    ctx.mail({
        to: target,
        templateKey: EMAIL_TEMPLATES.EMAIL_CHANGE_CONFIRM,
        lang: user.locale,
        data: {
            name: user.name,
            link: buildFrontendLink(
                FRONTEND_PATHS.CONFIRM_EMAIL_CHANGE,
                { token: issued.confirm.token },
                ctx.config.frontendUrl
            ),
            expiresIn: describeTtl(TYPE),
        },
    });
    sendUndoNotice({
        user,
        oldEmail: user.email,
        newEmail: target,
        token: issued.undo.token,
        ctx,
    });
}

/**
 * Applies the change when the NEW address confirms (doc 08 #17). The token is single use and bound to the old address:
 * if the account's email changed meanwhile, or the new address was taken, it is `EMAIL_CHANGE_INVALID`. Afterwards a
 * fresh 24 h undo link is mailed to the old address, so the undo window counts from the confirmation.
 */
export async function confirmEmailChange({ token }, ctx, now = new Date()) {
    let applied;
    try {
        applied = await withTransaction(async (session) => {
            const record = await consumeEmailToken(
                { token, type: TYPE, kind: CONFIRM },
                { session, now }
            );
            if (!record) throw invalidToken();
            const { oldEmail, newEmail } = record.meta;
            const user = await User.findOneAndUpdate(
                {
                    _id: record.userId,
                    email: oldEmail,
                    status: USER_STATUSES.ACTIVE,
                },
                {
                    $set: {
                        email: newEmail,
                        emailVerified: true,
                        emailVerifiedAt: now,
                    },
                },
                { session, returnDocument: "after" }
            );
            if (!user) throw invalidToken();
            await appendAudit(
                {
                    actorId: user._id,
                    orgId: user.orgId,
                    action: AUDIT_ACTIONS.EMAIL_CHANGED,
                    entityType: "user",
                    entityId: user._id,
                    meta: {
                        oldEmailHash: hashed(oldEmail, ctx),
                        newEmailHash: hashed(newEmail, ctx),
                    },
                },
                { session, now }
            );
            const undo = await issueEmailToken(
                {
                    type: TYPE,
                    userId: user._id,
                    orgId: user.orgId,
                    email: oldEmail,
                    meta: { kind: UNDO, oldEmail, newEmail },
                    ctx,
                },
                { session, now }
            );
            return { user, oldEmail, newEmail, undoToken: undo.token };
        });
    } catch (error) {
        // The new address was registered by someone else in the meantime: the unique index refused the change.
        if (error?.code === 11000) throw invalidToken(error);
        throw error;
    }
    sendUndoNotice({
        user: applied.user,
        oldEmail: applied.oldEmail,
        newEmail: applied.newEmail,
        token: applied.undoToken,
        ctx,
    });
    return { emailChanged: true };
}

/**
 * Undoes an email change from the OLD address (doc 08 #18, R38): cancels a pending change or restores the previous
 * address after it was applied, bumps `tokenVersion` and revokes ALL sessions (the account may have been taken over).
 */
export async function undoEmailChange({ token }, ctx, now = new Date()) {
    try {
        await withTransaction(async (session) => {
            const record = await consumeEmailToken(
                { token, type: TYPE, kind: UNDO },
                { session, now }
            );
            if (!record) throw invalidToken();
            const { oldEmail, newEmail } = record.meta;
            const user = await User.findById(record.userId).session(session);
            if (!user || ![oldEmail, newEmail].includes(user.email))
                throw invalidToken();
            await supersedeEmailTokens(
                { userId: user._id, type: TYPE, kind: CONFIRM },
                { session, now }
            );
            await User.updateOne(
                { _id: user._id },
                { $set: { email: oldEmail }, $inc: { tokenVersion: 1 } },
                { session }
            );
            await revokeAllSessions(
                user._id,
                SESSION_REVOKED_REASONS.LOGOUT_ALL,
                { session, now }
            );
            await appendAudit(
                {
                    actorId: user._id,
                    orgId: user.orgId,
                    action: AUDIT_ACTIONS.EMAIL_CHANGE_UNDONE,
                    entityType: "user",
                    entityId: user._id,
                    meta: { restored: user.email === newEmail },
                },
                { session, now }
            );
        });
    } catch (error) {
        if (error?.code === 11000) throw invalidToken(error);
        throw error;
    }
    return { restored: true };
}
