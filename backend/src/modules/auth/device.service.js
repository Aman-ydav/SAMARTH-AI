import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { buildFrontendLink } from "#integrations/email/emailLinks.mapper.js";
import { ne } from "#utils/mongoOps.js";
import { summarizeUserAgent } from "#utils/userAgent.js";
import { User } from "#modules/users/index.js";
import { appendAudit } from "#modules/audit/index.js";
import { FRONTEND_PATHS, MAX_KNOWN_DEVICES } from "./auth.constants.js";

/**
 * Remembers the device (user-agent hash) in the capped `knownDeviceHashes` list, oldest dropped at 20 (AUTH-39, R39).
 * One atomic conditional update, so it is race-free. Returns true when the device was NOT known before.
 */
export async function registerDevice({ userId, userAgentHash }) {
    const result = await User.updateOne(
        { _id: userId, knownDeviceHashes: ne(userAgentHash) },
        {
            $push: {
                knownDeviceHashes: {
                    $each: [userAgentHash],
                    $slice: -MAX_KNOWN_DEVICES,
                },
            },
        }
    );
    return result.modifiedCount === 1;
}

/** The "new sign-in" email and the `LOGIN_NEW_DEVICE` audit event for a device seen for the first time. */
export async function announceNewDevice({ user, ctx, now = new Date() }) {
    await appendAudit(
        {
            actorId: user._id,
            orgId: user.orgId,
            action: AUDIT_ACTIONS.LOGIN_NEW_DEVICE,
            entityType: "user",
            entityId: user._id,
            meta: { deviceHash: ctx.userAgentHash },
        },
        { now }
    );
    ctx.mail({
        to: user.email,
        templateKey: EMAIL_TEMPLATES.NEW_DEVICE,
        lang: user.locale,
        data: {
            name: user.name,
            device: summarizeUserAgent(ctx.userAgent),
            at: now.toISOString(),
            sessionsLink: buildFrontendLink(
                FRONTEND_PATHS.SECURITY,
                {},
                ctx.config.frontendUrl
            ),
        },
    });
}

/**
 * Called after a session is created. Registers the device; sends the notification only when the device is new AND
 * `notify` is true (the first session of a freshly created or verified account just seeds the list). Returns isNew.
 */
export async function handleDevice({
    user,
    ctx,
    notify = true,
    now = new Date(),
}) {
    const isNew = await registerDevice({
        userId: user._id,
        userAgentHash: ctx.userAgentHash,
    });
    if (isNew && notify) await announceNewDevice({ user, ctx, now });
    return isNew;
}
