import {
    JOB_FAILURE_CODES,
    JOB_LIMITS,
    JOB_TYPE_PATTERN,
} from "./jobs.constants.js";

/**
 * A handler throws this when running the job again cannot help (bad input, a record that no longer exists): the job
 * fails at once instead of burning its remaining attempts. `message` is stored on the job, so it must hold no personal
 * data; `code` is a short lowercase snake_case reason (stored lowercase, DB-03).
 */
export class NonRetryableJobError extends Error {
    constructor(message, code = JOB_FAILURE_CODES.NOT_RETRYABLE) {
        super(message);
        this.name = "NonRetryableJobError";
        this.code = String(code).toLowerCase().slice(0, 64);
    }
}

/**
 * Builds a registry that maps a job type to its handler. A handler is `async ({ job, signal, log, touch }) => result`:
 * `job` is `{ id, type, payload, attempt, maxAttempts, orgId, ownerId }`, `signal` aborts when the handler times out,
 * `touch()` extends the lock of a long job, and the returned value (a small JSON object) becomes `jobs.result`.
 * Handlers MUST be safe to run twice and write their results under deterministic keys (DB-49).
 */
export function createJobRegistry() {
    const handlers = new Map();

    /** Registers the handler of `type`; a bad type or a second handler for the same type is a startup bug. */
    function register(type, handler) {
        const valid =
            typeof type === "string" &&
            type.length <= JOB_LIMITS.typeMaxLength &&
            JOB_TYPE_PATTERN.test(type);
        if (!valid)
            throw new TypeError(
                `Invalid job type "${String(type).slice(0, 80)}"`
            );
        if (typeof handler !== "function")
            throw new TypeError(`The handler of "${type}" must be a function`);
        if (handlers.has(type))
            throw new TypeError(
                `A handler for job type "${type}" is already registered`
            );
        handlers.set(type, handler);
    }

    return Object.freeze({
        register,
        get: (type) => handlers.get(type),
        has: (type) => handlers.has(type),
        types: () => [...handlers.keys()],
    });
}

/** The registry the real worker uses; job files in `backend/src/jobs/` call `registerJobHandler` at import time. */
export const jobRegistry = createJobRegistry();
export const registerJobHandler = jobRegistry.register;
