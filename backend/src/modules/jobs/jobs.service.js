import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { toObjectId } from "#utils/mongo.js";
import { Job } from "./job.model.js";

/**
 * The job as its owner may see it (BE-47, DB-13): status, progress counters, timestamps, the handler's result and a
 * safe failure reason. The payload, lock fields and tenant ids are internal and never returned.
 */
export function toPublicJob(job) {
    return {
        id: String(job._id),
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        result: job.result ?? null,
        error: job.lastError?.code
            ? { code: job.lastError.code, message: job.lastError.message }
            : null,
        createdAt: job.createdAt,
        startedAt: job.startedAt ?? null,
        finishedAt: job.finishedAt ?? null,
    };
}

/**
 * Reads one job for its owner. The query is scoped by the owner and the organisation from the session, so another
 * user's job, a system job and an unknown id all answer the same 404 (BE-42, AUTH-62). Jobs vanish 30 days after
 * they end (TTL), which also answers 404: a polling client stops on a 404.
 */
export async function getOwnJob({ jobId, userId, orgId }) {
    const job = await Job.findOne({
        _id: toObjectId(jobId, "id"),
        ownerId: toObjectId(userId, "ownerId"),
        orgId: toObjectId(orgId, "orgId"),
    }).lean();
    if (!job) throw ApiError.notFound(ERROR_CODES.JOB_NOT_FOUND);
    return toPublicJob(job);
}
