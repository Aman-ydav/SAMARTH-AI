import { env } from "#config/env.js";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { ROLES } from "#constants/roles.js";
import { AUTH_PROVIDERS, USER_STATUSES } from "#constants/statuses.js";
import { hashPassword } from "#modules/auth/index.js";
import { User } from "#modules/users/index.js";
import { logger } from "#utils/logger.js";
import { normalizeEmail } from "#utils/strings.js";

const SEED_NAME = "Super Admin";
const SEED_POLICY_VERSION = "seed";

/**
 * Creates the first superadmin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (DB-36). Idempotent: an existing account with
 * that email is never touched (its password is never overwritten), so re-running is safe. The account is created with
 * `mustChangePassword`, because the password came from an env file: the first login gets only a limited session and
 * must call change-password (AUTH-38, R39). Without both variables the seed does nothing.
 *
 * @returns {Promise<{ created: boolean, skipped?: boolean }>}
 */
export async function seed({ log = logger, config = env } = {}) {
    const { adminEmail, adminPassword } = config.seed;
    if (!adminEmail || !adminPassword) {
        log.warn(
            "superadmin seed skipped: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not both set"
        );
        return { created: false, skipped: true };
    }
    const email = normalizeEmail(adminEmail);
    const now = new Date();
    const result = await User.updateOne(
        { email },
        {
            $setOnInsert: {
                orgId: DEFAULT_ORG_ID,
                name: SEED_NAME,
                passwordHash: await hashPassword(adminPassword),
                passwordChangedAt: now,
                role: ROLES.SUPERADMIN,
                status: USER_STATUSES.ACTIVE,
                emailVerified: true,
                emailVerifiedAt: now,
                authProviders: [AUTH_PROVIDERS.LOCAL],
                mustChangePassword: true,
                termsAcceptedAt: now,
                policyVersion: SEED_POLICY_VERSION,
            },
        },
        { upsert: true }
    );
    const created = result.upsertedCount === 1;
    log.info(
        { created },
        created ? "superadmin created" : "superadmin already exists"
    );
    return { created };
}
