import { sweepMedia } from "#modules/media/index.js";
import { logger } from "#utils/logger.js";

/** Daily at 03:00 UTC (MEDIA-12). There is no scheduler yet; whoever adds `jobs/scheduler.js` registers this entry. */
export const MEDIA_ORPHAN_SWEEP = Object.freeze({
    name: "mediaOrphanSweep",
    cron: "0 3 * * *",
});

/**
 * Job entry point: deletes stale pending uploads, expired `temp/` assets and retries failed Cloudinary deletes.
 * `dryRun: true` only counts the candidates (the review flag of MEDIA-12). Returns the per-step counts.
 */
export async function runMediaOrphanSweep(options = {}) {
    const summary = await sweepMedia({ log: logger, ...options });
    logger.info(
        { job: MEDIA_ORPHAN_SWEEP.name },
        "media orphan sweep job done"
    );
    return summary;
}
