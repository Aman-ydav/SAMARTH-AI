import { JOB_STATUSES } from "#constants/statuses.js";
import { ApiError } from "#utils/apiError.js";
import { addMs } from "#utils/dates.js";
import { toObjectId } from "#utils/mongo.js";
import { lt, lte } from "#utils/mongoOps.js";
import { Job } from "./job.model.js";
import {
    JOB_FAILURE_CODES,
    JOB_KEY_PATTERN,
    JOB_LIMITS,
    JOB_QUEUE,
    JOB_TYPE_PATTERN,
} from "./jobs.constants.js";

const DUPLICATE_KEY = 11000;

const jsonBytes = (value) =>
    Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
const invalid = (field, message) =>
    ApiError.validation([{ field, message, code: "invalid" }]);
const normaliseKey = (key) =>
    String(key ?? "")
        .trim()
        .toLowerCase();
const toOptionalObjectId = (value, field) =>
    value === null || value === undefined ? null : toObjectId(value, field);

/** Fields set when a job ends: the TTL clock starts and the lock is released (DB-49). */
const terminalFields = (now) => ({
    finishedAt: now,
    expiresAt: addMs(now, JOB_QUEUE.retentionMs),
    lockedBy: null,
    lockedUntil: null,
});

/** Delay before retry number `attempt` (1-based): base times two to the power of the earlier attempts, capped. */
export function computeBackoffMs(
    attempt,
    { baseMs = JOB_QUEUE.backoffBaseMs, capMs = JOB_QUEUE.backoffCapMs } = {}
) {
    const exponent = Math.max(0, Math.min(attempt - 1, 30));
    return Math.min(baseMs * 2 ** exponent, capMs);
}

function assertEnqueueInput({ type, key, payload, maxAttempts }) {
    if (
        typeof type !== "string" ||
        type.length > JOB_LIMITS.typeMaxLength ||
        !JOB_TYPE_PATTERN.test(type)
    )
        throw invalid("type", "The job type is not valid");
    if (key.length > JOB_LIMITS.keyMaxLength || !JOB_KEY_PATTERN.test(key))
        throw invalid("idempotencyKey", "The idempotency key is not valid");
    if (
        payload === null ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    )
        throw invalid("payload", "The payload must be an object");
    if (jsonBytes(payload) > JOB_LIMITS.payloadMaxBytes)
        throw invalid("payload", "The payload is too large");
    if (
        !Number.isInteger(maxAttempts) ||
        maxAttempts < 1 ||
        maxAttempts > JOB_LIMITS.maxAttemptsCeiling
    )
        throw invalid("maxAttempts", "maxAttempts is out of range");
}

const toEnqueueResult = (job, created) => ({
    id: String(job._id),
    type: job.type,
    status: job.status,
    created,
});

/**
 * Enqueues a job, once per `{ type, idempotencyKey }` (DB-49, EDGE-112). Calling it again with the same type and key
 * returns the existing job with `created: false` and changes nothing, so a double click or a retried request never
 * starts the work twice. Two callers racing on the same key end up with one row (unique index, EDGE-33).
 *
 * @param {object} input
 * @param {string} input.type lowercase dotted code of a registered handler
 * @param {string} input.idempotencyKey caller-chosen key for "this exact piece of work" (case-insensitive)
 * @param {object} [input.payload] small JSON object for the handler (at most 16 KB); no secrets or personal data
 * @param {string|null} [input.orgId] tenant of a user-triggered job
 * @param {string|null} [input.ownerId] user who may read the job through `GET /jobs/:id`
 * @param {Date} [input.runAt] earliest start
 * @param {number} [input.maxAttempts] total tries including the first
 * @returns {Promise<{ id: string, type: string, status: string, created: boolean }>}
 */
export async function enqueueJob({
    type,
    idempotencyKey,
    payload = {},
    orgId = null,
    ownerId = null,
    runAt = new Date(),
    maxAttempts = JOB_LIMITS.defaultMaxAttempts,
}) {
    const key = normaliseKey(idempotencyKey);
    assertEnqueueInput({ type, key, payload, maxAttempts });
    const filter = { type, idempotencyKey: key };
    const insert = {
        orgId: toOptionalObjectId(orgId, "orgId"),
        ownerId: toOptionalObjectId(ownerId, "ownerId"),
        payload,
        status: JOB_STATUSES.QUEUED,
        attempts: 0,
        maxAttempts,
        runAt: new Date(runAt),
    };
    try {
        const outcome = await Job.updateOne(
            filter,
            { $setOnInsert: insert },
            { upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        const job = await Job.findOne(filter).lean();
        return toEnqueueResult(job, outcome.upsertedCount === 1);
    } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error;
        // Another enqueue of the same key won the insert race: its row is the job.
        const existing = await Job.findOne(filter).lean();
        return toEnqueueResult(existing, false);
    }
}

/**
 * Atomically takes the oldest job that is due: one `findOneAndUpdate` flips it from `queued` to `running`, stamps the
 * lock and counts the attempt, so two workers can never hold the same job (DB-49). Returns the lean job or `null`.
 */
export async function claimNextJob({
    workerId,
    lockMs = JOB_QUEUE.lockMs,
    now = new Date(),
}) {
    return Job.findOneAndUpdate(
        { status: JOB_STATUSES.QUEUED, runAt: lte(now) },
        {
            $set: {
                status: JOB_STATUSES.RUNNING,
                lockedBy: workerId,
                lockedUntil: addMs(now, lockMs),
                startedAt: now,
            },
            $inc: { attempts: 1 },
        },
        { sort: { runAt: 1, _id: 1 }, returnDocument: "after", lean: true }
    );
}

/** Pushes the lock of a running job forward (a long handler calls this). `false` means the lock was already lost. */
export async function extendJobLock({
    jobId,
    workerId,
    lockMs = JOB_QUEUE.lockMs,
    now = new Date(),
}) {
    const outcome = await Job.updateOne(
        { _id: jobId, status: JOB_STATUSES.RUNNING, lockedBy: workerId },
        { $set: { lockedUntil: addMs(now, lockMs) } }
    );
    return outcome.modifiedCount === 1;
}

/**
 * Marks a running job done and stores its result. Only the worker that still holds the lock may do it: after a
 * recovery handed the job to someone else this returns `null` and the stale result is dropped. A result over the cap
 * is replaced by `{ truncated: true }` rather than failing a job whose work already happened.
 */
export async function completeJob({
    jobId,
    workerId,
    result,
    now = new Date(),
}) {
    const fits =
        result === undefined || jsonBytes(result) <= JOB_LIMITS.resultMaxBytes;
    const stored = fits ? result : { truncated: true };
    const set = { status: JOB_STATUSES.DONE, ...terminalFields(now) };
    if (stored !== undefined) set.result = stored;
    return Job.findOneAndUpdate(
        { _id: jobId, status: JOB_STATUSES.RUNNING, lockedBy: workerId },
        { $set: set, $unset: { lastError: "" } },
        { returnDocument: "after", lean: true }
    );
}

/**
 * Records a failed attempt. A retryable failure with attempts left goes back to `queued` with `runAt` pushed out by
 * the exponential backoff; anything else ends as `failed`. Only the lock holder may do it (returns `null` otherwise).
 * `code` and `message` are stored and shown to the owner, so they must be safe, short and free of personal data.
 */
export async function failJob({
    job,
    workerId,
    code,
    message,
    retryable = true,
    now = new Date(),
}) {
    const lastError = {
        code,
        message: String(message).slice(0, JOB_LIMITS.errorMessageMaxLength),
    };
    const willRetry = retryable && job.attempts < job.maxAttempts;
    const set = willRetry
        ? {
              status: JOB_STATUSES.QUEUED,
              runAt: addMs(now, computeBackoffMs(job.attempts)),
              lockedBy: null,
              lockedUntil: null,
              lastError,
          }
        : { status: JOB_STATUSES.FAILED, lastError, ...terminalFields(now) };
    return Job.findOneAndUpdate(
        { _id: job._id, status: JOB_STATUSES.RUNNING, lockedBy: workerId },
        { $set: set },
        { returnDocument: "after", lean: true }
    );
}

/**
 * Recovers running jobs whose lock ran out because their worker died (EDGE-112: "job lost after restart"). Each job is
 * re-checked in its own conditional update, so a job that finished in the meantime is left alone. A job with attempts
 * left is re-queued with backoff; one without fails with `lock_expired`.
 * @returns {Promise<{ requeued: number, failedJobs: object[] }>} `failedJobs` are the lean jobs that ended as failed
 */
export async function recoverStuckJobs({
    now = new Date(),
    limit = JOB_QUEUE.recoverBatch,
} = {}) {
    const stuck = await Job.find({
        status: JOB_STATUSES.RUNNING,
        lockedUntil: lt(now),
    })
        .sort({ lockedUntil: 1 })
        .limit(limit)
        .lean();
    let requeued = 0;
    const failedJobs = [];
    for (const job of stuck) {
        const exhausted = job.attempts >= job.maxAttempts;
        const lastError = {
            code: JOB_FAILURE_CODES.LOCK_EXPIRED,
            message: "The worker stopped before the job finished.",
        };
        const set = exhausted
            ? { status: JOB_STATUSES.FAILED, lastError, ...terminalFields(now) }
            : {
                  status: JOB_STATUSES.QUEUED,
                  runAt: addMs(now, computeBackoffMs(job.attempts)),
                  lockedBy: null,
                  lockedUntil: null,
                  lastError,
              };
        const updated = await Job.findOneAndUpdate(
            {
                _id: job._id,
                status: JOB_STATUSES.RUNNING,
                lockedUntil: lt(now),
            },
            { $set: set },
            { returnDocument: "after", lean: true }
        );
        if (!updated) continue;
        if (exhausted) failedJobs.push(updated);
        else requeued += 1;
    }
    return { requeued, failedJobs };
}
