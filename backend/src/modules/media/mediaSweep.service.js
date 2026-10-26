import { MEDIA_KINDS } from "#constants/mediaKinds.js";
import { MEDIA_STATUSES } from "#constants/statuses.js";
import { addMs } from "#utils/dates.js";
import { logger } from "#utils/logger.js";
import { lt } from "#utils/mongoOps.js";
import {
    PURGE_RETRY_AFTER_MS,
    STALE_PENDING_MS,
    SWEEP_BATCH_SIZE,
    TEMP_MAX_AGE_MS,
} from "./media.constants.js";
import { Media } from "./media.model.js";
import { purgeAsset, retireMedia } from "./mediaCleanup.service.js";

const before = (now, ms) => addMs(now, -ms);

/** Runs `action` over each record one at a time (Cloudinary rate limits, MEDIA-12) and counts the outcomes. */
async function processBatch(records, action, dryRun) {
    const outcome = { found: records.length, purged: 0, failed: 0 };
    if (dryRun) return outcome;
    for (const record of records) {
        if (await action(record)) outcome.purged += 1;
        else outcome.failed += 1;
    }
    return outcome;
}

/**
 * Orphan sweep (MEDIA-12), a pure function so a scheduler or a one-off script can call it. In one run, each bounded:
 *  1. `pending` records never confirmed after 24 h: delete the asset (if the browser uploaded one) and retire the record.
 *  2. `temp/` assets older than 24 h.
 *  3. records already `deleted` whose Cloudinary delete failed earlier (`purgedAt` is null): try again.
 * With `dryRun` nothing is changed and only the candidates are counted. The "report assets with no DB reference older
 * than 7 days" step needs a Cloudinary listing call that the adapter does not offer yet (see report, deferred).
 */
export async function sweepMedia({
    now = new Date(),
    batchSize = SWEEP_BATCH_SIZE,
    dryRun = false,
    log = logger,
} = {}) {
    const withDeleted = { withDeleted: true };
    const stalePending = await Media.find({
        status: MEDIA_STATUSES.PENDING,
        createdAt: lt(before(now, STALE_PENDING_MS)),
    })
        .setOptions(withDeleted)
        .sort({ createdAt: 1 })
        .limit(batchSize)
        .lean();
    const expiredTemp = await Media.find({
        kind: MEDIA_KINDS.TEMP,
        status: MEDIA_STATUSES.READY,
        createdAt: lt(before(now, TEMP_MAX_AGE_MS)),
    })
        .setOptions(withDeleted)
        .sort({ createdAt: 1 })
        .limit(batchSize)
        .lean();
    const unpurged = await Media.find({
        status: MEDIA_STATUSES.DELETED,
        purgedAt: null,
        deletedAt: lt(before(now, PURGE_RETRY_AFTER_MS)),
    })
        .setOptions(withDeleted)
        .sort({ deletedAt: 1 })
        .limit(batchSize)
        .lean();

    const retire = (record) => retireMedia(record, now);
    const retry = (record) => purgeAsset(record, now);
    const summary = {
        dryRun,
        stalePending: await processBatch(stalePending, retire, dryRun),
        expiredTemp: await processBatch(expiredTemp, retire, dryRun),
        retriedPurges: await processBatch(unpurged, retry, dryRun),
    };
    log.info(
        { event: "media.sweep", ...summary },
        "media orphan sweep finished"
    );
    return summary;
}
