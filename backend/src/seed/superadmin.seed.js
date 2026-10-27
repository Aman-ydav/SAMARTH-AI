import { env } from "#config/env.js";
import { syncPlatformAdmins } from "#modules/admin/index.js";
import { emailService } from "#services/email.service.js";
import { logger } from "#utils/logger.js";

/**
 * Creates the platform admins (R68, DB-36). It runs the same sync the server runs on every start, so `npm run seed` and a
 * normal start never disagree: the accounts come from PLATFORM_ADMINS plus the legacy SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD pair. Idempotent: an existing platform admin is never touched, a password is never overwritten.
 * Set-password mails (entries without a password) are delivered before the script exits.
 *
 * @returns {Promise<{ created: boolean, skipped?: boolean, outcome?: object }>}
 */
export async function seed({ log = logger, config = env } = {}) {
    if ((config.platformAdmins ?? []).length === 0) {
        log.warn(
            "platform admin seed skipped: set PLATFORM_ADMINS (or SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)"
        );
        return { created: false, skipped: true };
    }
    const outcome = await syncPlatformAdmins({ config, log, emailService });
    await emailService.whenSettled();
    return { created: outcome.created > 0, outcome };
}
