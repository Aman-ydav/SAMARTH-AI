import { env } from "#config/env.js";
import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { ROLES } from "#constants/roles.js";
import {
    AUTH_PROVIDERS,
    SESSION_REVOKED_REASONS,
    USER_STATUSES,
} from "#constants/statuses.js";
import { withTransaction } from "#db/transaction.js";
import { appendAudit } from "#modules/audit/index.js";
import {
    assertPasswordPolicy,
    hashPassword,
    issuePasswordSetup,
    revokeAllSessions,
} from "#modules/auth/index.js";
import { User } from "#modules/users/index.js";
import { emailService as defaultEmailService } from "#services/email.service.js";
import { hmacIdentifier } from "#utils/hash.js";
import { logger } from "#utils/logger.js";
import { ne } from "#utils/mongoOps.js";

const PLATFORM_ADMIN_NAME = "Platform admin";
const POLICY_VERSION = "platform-admins";
const DUPLICATE_KEY = 11000;

export const SYNC_OUTCOMES = Object.freeze({
    CREATED: "created",
    PROMOTED: "promoted",
    UNCHANGED: "unchanged",
    SKIPPED: "skipped",
    FAILED: "failed",
});

// A failure is logged by name, code and message with the entry's password and address scrubbed out (BE-81, AUTH-24); the raw env value is never logged.
function describeFailure(error, entry) {
    const scrub = (text) => {
        let clean = String(text ?? "");
        if (entry.password)
            clean = clean.replaceAll(entry.password, "[redacted]");
        return clean.replaceAll(entry.email, "[email]");
    };
    return {
        name: error?.name ?? "Error",
        code: error?.code ?? null,
        message: scrub(error?.message),
        problems: Array.isArray(error?.errors)
            ? error.errors.map((item) => item.code).filter(Boolean)
            : undefined,
        stack: scrub(error?.stack),
    };
}

/**
 * Creates the account for a platform-admin entry that does not exist yet. One transaction does the atomic upsert (so
 * several instances starting at once create exactly one account), the audit entry and, for an entry without a password,
 * the set-password token. Returns the mail to queue after the commit, or null when another instance won the race.
 */
async function createPlatformAdmin(entry, { passwordHash, config, now }) {
    try {
        return await withTransaction(async (session) => {
            const result = await User.updateOne(
                { email: entry.email },
                {
                    $setOnInsert: {
                        orgId: DEFAULT_ORG_ID,
                        name: PLATFORM_ADMIN_NAME,
                        role: ROLES.SUPERADMIN,
                        status: USER_STATUSES.ACTIVE,
                        emailVerified: true,
                        emailVerifiedAt: now,
                        authProviders: [AUTH_PROVIDERS.LOCAL],
                        // A password that came from an env file is temporary: the first login only gets a limited session (AUTH-38).
                        mustChangePassword: Boolean(passwordHash),
                        termsAcceptedAt: now,
                        policyVersion: POLICY_VERSION,
                        ...(passwordHash
                            ? { passwordHash, passwordChangedAt: now }
                            : {}),
                    },
                },
                { upsert: true, session }
            );
            if (result.upsertedCount !== 1) return null;
            const user = await User.findOne({ email: entry.email }).session(
                session
            );
            await appendAudit(
                {
                    orgId: user.orgId,
                    action: AUDIT_ACTIONS.PLATFORM_ADMIN_CREATED,
                    entityType: "user",
                    entityId: user._id,
                    meta: {
                        setup: passwordHash ? "env_password" : "email_link",
                    },
                },
                { session, now }
            );
            return passwordHash
                ? { created: true }
                : {
                      created: true,
                      mail: await issuePasswordSetup(user, {
                          config,
                          session,
                          now,
                      }),
                  };
        });
    } catch (error) {
        // A second instance inserted the same email between our upsert and its commit: it owns the creation (and the mail).
        if (
            error?.code === DUPLICATE_KEY ||
            error?.cause?.code === DUPLICATE_KEY
        )
            return null;
        throw error;
    }
}

/** Promotes a verified, active account to superadmin and signs the person out everywhere so the new role takes effect. */
async function promote(user, now) {
    return withTransaction(async (session) => {
        const result = await User.updateOne(
            {
                _id: user._id,
                role: ne(ROLES.SUPERADMIN),
                status: USER_STATUSES.ACTIVE,
                emailVerified: true,
            },
            { $set: { role: ROLES.SUPERADMIN }, $inc: { tokenVersion: 1 } },
            { session }
        );
        if (result.modifiedCount !== 1) return false;
        await revokeAllSessions(user._id, SESSION_REVOKED_REASONS.ADMIN, {
            session,
            now,
        });
        await appendAudit(
            {
                orgId: user.orgId,
                action: AUDIT_ACTIONS.ROLE_CHANGED,
                entityType: "user",
                entityId: user._id,
                meta: {
                    from: user.role,
                    to: ROLES.SUPERADMIN,
                    source: "platform_admins",
                },
            },
            { session, now }
        );
        return true;
    });
}

async function syncEntry(entry, { config, now, queueMail, log, label }) {
    const existing = await User.findOne({ email: entry.email })
        .select("role status emailVerified orgId")
        .lean();
    if (!existing) {
        // The password rules run in full here (denylist, email in password); a refusal skips only this entry.
        if (entry.password)
            assertPasswordPolicy(entry.password, { email: entry.email });
        const passwordHash = entry.password
            ? await hashPassword(entry.password)
            : undefined;
        const created = await createPlatformAdmin(entry, {
            passwordHash,
            config,
            now,
        });
        if (!created) return SYNC_OUTCOMES.UNCHANGED;
        if (created.mail) queueMail(created.mail);
        log.info({ ...label }, "platform admin created");
        return SYNC_OUTCOMES.CREATED;
    }
    if (existing.role === ROLES.SUPERADMIN) return SYNC_OUTCOMES.UNCHANGED;
    if (!existing.emailVerified || existing.status !== USER_STATUSES.ACTIVE) {
        log.warn(
            { ...label, status: existing.status },
            "platform admin entry skipped: the existing account is not verified and active, so it was not promoted"
        );
        return SYNC_OUTCOMES.SKIPPED;
    }
    if (!(await promote(existing, now))) return SYNC_OUTCOMES.UNCHANGED;
    log.info({ ...label, from: existing.role }, "platform admin promoted");
    return SYNC_OUTCOMES.PROMOTED;
}

/**
 * Makes the accounts listed in `PLATFORM_ADMINS` (plus the legacy SEED_ADMIN pair) exist as platform admins (R68). Runs
 * on every server start, after the database connects, in production too, and from `npm run seed`. Idempotent and safe
 * when several instances start together: creation is one atomic upsert, promotion is a conditional update.
 *
 * - New email: a superadmin is created (active, verified, local sign-in). With a password the hash is stored and
 *   `mustChangePassword` is set; without one the account has no password and ONE set-password mail goes out, only now.
 * - Existing active, verified account: promoted to superadmin; role-change audit entry; every session is revoked and
 *   `tokenVersion` is bumped, so the new role applies at the next sign-in.
 * - Existing unverified (or suspended, deactivated...) account: not promoted, a warning is logged.
 * - Existing superadmin: untouched, its password is never overwritten. Removing an entry never demotes anyone.
 *
 * One entry failing is logged (code only, never a password or the raw value) and the others still run.
 *
 * @returns {Promise<{ created: number, promoted: number, unchanged: number, skipped: number, failed: number }>}
 */
export async function syncPlatformAdmins({
    config = env,
    log = logger,
    emailService = defaultEmailService,
    now = new Date(),
} = {}) {
    const counts = Object.fromEntries(
        Object.values(SYNC_OUTCOMES).map((outcome) => [outcome, 0])
    );
    const entries = config.platformAdmins ?? [];
    if (entries.length === 0) {
        log.warn(
            "no platform admin is configured: set PLATFORM_ADMINS (or the legacy SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)"
        );
        return counts;
    }
    const queueMail = (message) => emailService.enqueueEmail(message);
    for (const [index, entry] of entries.entries()) {
        const label = {
            entry: index + 1,
            ref: hmacIdentifier(
                entry.email,
                config.auth.identifierHashSecret
            ).slice(0, 12),
        };
        try {
            const outcome = await syncEntry(entry, {
                config,
                now,
                queueMail,
                log,
                label,
            });
            counts[outcome] += 1;
        } catch (error) {
            counts[SYNC_OUTCOMES.FAILED] += 1;
            log.error(
                { ...label, failure: describeFailure(error, entry) },
                "platform admin entry failed and was skipped"
            );
        }
    }
    return counts;
}
