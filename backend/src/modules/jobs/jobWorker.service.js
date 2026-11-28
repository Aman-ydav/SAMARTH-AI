import { randomUUID } from "node:crypto";
import { JOB_STATUSES } from "#constants/statuses.js";
import { eventBus as defaultBus } from "#events/eventBus.js";
import { JOB_EVENTS } from "#events/job.events.js";
import { logger as rootLogger } from "#utils/logger.js";
import {
    claimNextJob,
    completeJob,
    extendJobLock,
    failJob,
    recoverStuckJobs,
} from "./jobQueue.service.js";
import {
    jobRegistry as defaultRegistry,
    NonRetryableJobError,
} from "./jobRegistry.service.js";
import { JOB_FAILURE_CODES, JOB_QUEUE } from "./jobs.constants.js";

class JobTimeoutError extends Error {
    constructor() {
        super("The job handler timed out");
        this.name = "JobTimeoutError";
    }
}

/** Maps whatever a handler threw to the safe `{ code, message, retryable }` stored on the job. */
function describeFailure(error) {
    if (error instanceof NonRetryableJobError)
        return {
            code: error.code,
            message: error.message,
            retryable: false,
        };
    if (error instanceof JobTimeoutError)
        return {
            code: JOB_FAILURE_CODES.HANDLER_TIMEOUT,
            message: "The job handler timed out.",
            retryable: true,
        };
    return {
        code: JOB_FAILURE_CODES.HANDLER_ERROR,
        message: "The job handler failed.",
        retryable: true,
    };
}

const toHandlerJob = (job) => ({
    id: String(job._id),
    type: job.type,
    payload: job.payload ?? {},
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
    orgId: job.orgId ? String(job.orgId) : null,
    ownerId: job.ownerId ? String(job.ownerId) : null,
});

/**
 * Builds the in-process worker (DB-49). It polls the queue, runs ONE job at a time (low memory on the free tier) and
 * is safe next to other workers because every claim, completion and recovery is an atomic conditional update. It
 * is created and started from `index.js` only, never from `app.js`, so Supertest and unit tests stay deterministic.
 * A handler that runs past `lockMs` is aborted through its `signal` and counted as a failed attempt.
 *
 * @param {object} [options]
 * @param {{ get: Function }} [options.registry] job type to handler map
 * @param {{ emit: Function }} [options.bus] event bus that receives `job.completed` and `job.failed`
 * @param {object} [options.log] pino logger
 * @param {string} [options.workerId] unique per process; stamped on the lock
 * @param {number} [options.pollIntervalMs] wait between polls when the queue is empty
 * @param {number} [options.lockMs] lock length and handler time limit
 * @param {number} [options.recoverIntervalMs] how often stuck jobs are looked for
 * @param {() => Date} [options.now] clock (tests inject a fake)
 * @param {Function} [options.setTimer] `setTimeout` (tests inject a fake)
 * @param {Function} [options.clearTimer] `clearTimeout` (tests inject a fake)
 */
export function createJobWorker({
    registry = defaultRegistry,
    bus = defaultBus,
    log = rootLogger,
    workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`,
    pollIntervalMs = JOB_QUEUE.pollIntervalMs,
    lockMs = JOB_QUEUE.lockMs,
    recoverIntervalMs = JOB_QUEUE.recoverIntervalMs,
    now = () => new Date(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
} = {}) {
    let running = false;
    let timer = null;
    let inFlight = null;
    let lastRecoverAt = null;
    let consecutiveErrors = 0;

    async function announce(event, job) {
        await bus.emit(event, {
            jobId: String(job._id),
            type: job.type,
            status: job.status,
            ownerId: job.ownerId ? String(job.ownerId) : null,
            orgId: job.orgId ? String(job.orgId) : null,
        });
    }

    async function recoverIfDue() {
        const current = now();
        if (lastRecoverAt && current - lastRecoverAt < recoverIntervalMs)
            return;
        lastRecoverAt = current;
        const { requeued, failedJobs } = await recoverStuckJobs({
            now: current,
        });
        if (requeued > 0 || failedJobs.length > 0)
            log.warn(
                { requeued, failed: failedJobs.length },
                "recovered stuck jobs"
            );
        for (const job of failedJobs) await announce(JOB_EVENTS.FAILED, job);
    }

    /** Runs the handler under a time limit; on timeout the signal aborts and the attempt fails (the work may linger). */
    function runHandler(handler, job) {
        const controller = new AbortController();
        let limit;
        const timeout = new Promise((_, reject) => {
            limit = setTimer(() => {
                controller.abort();
                reject(new JobTimeoutError());
            }, lockMs);
        });
        const context = {
            job: toHandlerJob(job),
            signal: controller.signal,
            log: log.child
                ? log.child({ jobId: String(job._id), type: job.type })
                : log,
            touch: () =>
                extendJobLock({
                    jobId: job._id,
                    workerId,
                    lockMs,
                    now: now(),
                }),
        };
        // `Promise.resolve().then` turns a synchronous throw into a rejection, so the timer is always cleared below.
        return Promise.race([
            Promise.resolve().then(() => handler(context)),
            timeout,
        ]).finally(() => clearTimer(limit));
    }

    async function fail(job, failure) {
        const updated = await failJob({
            job,
            workerId,
            ...failure,
            now: now(),
        });
        if (!updated) return "lock_lost";
        if (updated.status !== JOB_STATUSES.FAILED) return "retry";
        await announce(JOB_EVENTS.FAILED, updated);
        return "failed";
    }

    async function complete(job, result) {
        const updated = await completeJob({
            jobId: job._id,
            workerId,
            result,
            now: now(),
        });
        if (!updated) {
            log.warn(
                { jobId: String(job._id), type: job.type },
                "job finished after its lock was lost; result dropped"
            );
            return "lock_lost";
        }
        await announce(JOB_EVENTS.COMPLETED, updated);
        return "done";
    }

    async function execute(job) {
        const handler = registry.get(job.type);
        if (!handler)
            return fail(job, {
                code: JOB_FAILURE_CODES.NO_HANDLER,
                message: "No handler is registered for this job type.",
                retryable: false,
            });
        let result;
        try {
            result = await runHandler(handler, job);
        } catch (error) {
            log.error(
                {
                    err: error,
                    jobId: String(job._id),
                    type: job.type,
                    attempt: job.attempts,
                },
                "job handler failed"
            );
            return fail(job, describeFailure(error));
        }
        return complete(job, result);
    }

    /** One cycle: recover stuck jobs when due, claim the next due job and run it. Exposed so tests drive it directly. */
    async function runOnce() {
        await recoverIfDue();
        const job = await claimNextJob({ workerId, lockMs, now: now() });
        if (!job) return { ran: false };
        const outcome = await execute(job);
        return { ran: true, jobId: String(job._id), outcome };
    }

    function schedule(delayMs) {
        if (!running) return;
        timer = setTimer(tick, delayMs);
        timer.unref?.();
    }

    async function runTick() {
        let delay = pollIntervalMs;
        try {
            const outcome = await runOnce();
            consecutiveErrors = 0;
            // A job just ran: look again at once; an empty queue waits for the poll interval.
            if (outcome.ran) delay = 0;
        } catch (error) {
            consecutiveErrors += 1;
            delay = Math.min(
                pollIntervalMs * 2 ** Math.min(consecutiveErrors, 6),
                JOB_QUEUE.maxErrorBackoffMs
            );
            log.error(
                { err: error, consecutiveErrors },
                "job worker cycle failed"
            );
        }
        schedule(delay);
    }

    function tick() {
        timer = null;
        if (!running) return;
        inFlight = runTick();
    }

    /** Starts polling. Starting a running worker does nothing. */
    function start() {
        if (running) return;
        running = true;
        schedule(0);
        log.info({ workerId }, "job worker started");
    }

    /** Stops polling and waits for the job in progress (if any) to settle. Safe to call twice. */
    async function stop() {
        running = false;
        if (timer) {
            clearTimer(timer);
            timer = null;
        }
        await inFlight;
        inFlight = null;
        log.info({ workerId }, "job worker stopped");
    }

    return Object.freeze({
        id: workerId,
        start,
        stop,
        runOnce,
        isRunning: () => running,
    });
}
