/**
 * Domain events of the job worker (FS-16). Payloads carry ids and the job type only, never the job payload or result
 * (EDGE-72: no personal data in event traffic): `{ jobId, type, status, ownerId, orgId }`, ids as strings or null.
 */
export const JOB_EVENTS = Object.freeze({
    COMPLETED: "job.completed",
    FAILED: "job.failed",
});
