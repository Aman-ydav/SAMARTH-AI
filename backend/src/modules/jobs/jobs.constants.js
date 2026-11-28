const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Job types are lowercase dotted codes such as `content.extract-text`; keys are lowercase ids, hashes or `type:id` pairs. */
export const JOB_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
export const JOB_KEY_PATTERN = /^[a-z0-9][a-z0-9:_.-]*$/;

export const JOB_LIMITS = Object.freeze({
    typeMaxLength: 64,
    keyMaxLength: 128,
    // DB-05: `payload` and `result` are the only free-form fields of the collection, so both are size-capped.
    payloadMaxBytes: 16_384,
    resultMaxBytes: 16_384,
    errorMessageMaxLength: 500,
    defaultMaxAttempts: 3,
    maxAttemptsCeiling: 10,
});

/** Queue timing. One job at a time per worker keeps memory low on the free tier. */
export const JOB_QUEUE = Object.freeze({
    pollIntervalMs: 2 * SECOND_MS,
    // A running job whose lock is older than this is treated as abandoned (its worker died) and is recovered.
    lockMs: 5 * MINUTE_MS,
    recoverIntervalMs: 30 * SECOND_MS,
    recoverBatch: 50,
    backoffBaseMs: 5 * SECOND_MS,
    backoffCapMs: HOUR_MS,
    maxErrorBackoffMs: MINUTE_MS,
    // DB-49: finished jobs expire by TTL after 30 days.
    retentionMs: 30 * DAY_MS,
});

/** Codes stored in `jobs.lastError.code`, lowercase snake case like every stored enum (DB-03); never raw third-party text. */
export const JOB_FAILURE_CODES = Object.freeze({
    NO_HANDLER: "no_handler",
    HANDLER_ERROR: "handler_error",
    HANDLER_TIMEOUT: "handler_timeout",
    LOCK_EXPIRED: "lock_expired",
    NOT_RETRYABLE: "job_not_retryable",
});

/** Per-user limits for `GET /jobs/:id`; clients poll, so the read limit allows about one request every 1.5 s. */
export const JOB_RATE_LIMITS = Object.freeze({
    read: { name: "jobs-read", windowMs: 15 * MINUTE_MS, limit: 600 },
});
