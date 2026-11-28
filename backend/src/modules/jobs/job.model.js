import mongoose from "mongoose";
import { JOB_STATUS_LIST, JOB_STATUSES } from "#constants/statuses.js";
import { toJsonPlugin } from "#db/toJsonPlugin.js";
import {
    JOB_KEY_PATTERN,
    JOB_LIMITS,
    JOB_TYPE_PATTERN,
} from "./jobs.constants.js";

const integer = { validator: Number.isInteger, message: "JOB_NOT_AN_INTEGER" };
const jsonBytes = (value) =>
    Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
const cappedJson = (max, message) => ({
    validator: (value) => jsonBytes(value) <= max,
    message,
});

const jobSchema = new mongoose.Schema(
    {
        // System jobs (for example a nightly sweep) have no tenant or owner; user-triggered jobs carry both (DB-38).
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            immutable: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            immutable: true,
        },
        type: {
            type: String,
            required: [true, "JOB_TYPE_REQUIRED"],
            trim: true,
            lowercase: true,
            maxlength: JOB_LIMITS.typeMaxLength,
            match: JOB_TYPE_PATTERN,
            immutable: true,
        },
        // Same input, same key: enqueueing it twice returns the first job instead of creating a duplicate (DB-49, EDGE-112).
        idempotencyKey: {
            type: String,
            required: [true, "JOB_KEY_REQUIRED"],
            trim: true,
            lowercase: true,
            maxlength: JOB_LIMITS.keyMaxLength,
            match: JOB_KEY_PATTERN,
            immutable: true,
        },
        // DB-05 exception: free-form by design, so handlers of any type can use it. Capped at payloadMaxBytes.
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
            validate: cappedJson(
                JOB_LIMITS.payloadMaxBytes,
                "JOB_PAYLOAD_TOO_LARGE"
            ),
        },
        status: {
            type: String,
            required: [true, "JOB_STATUS_REQUIRED"],
            enum: JOB_STATUS_LIST,
            default: JOB_STATUSES.QUEUED,
        },
        attempts: {
            type: Number,
            min: 0,
            max: JOB_LIMITS.maxAttemptsCeiling,
            validate: integer,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            min: 1,
            max: JOB_LIMITS.maxAttemptsCeiling,
            validate: integer,
            default: JOB_LIMITS.defaultMaxAttempts,
        },
        // The job is claimable once `runAt` has passed; a retry pushes it forward by the backoff.
        runAt: { type: Date, required: [true, "JOB_RUN_AT_REQUIRED"] },
        lockedBy: {
            type: String,
            trim: true,
            maxlength: 64,
            default: null,
        },
        lockedUntil: { type: Date, default: null },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        // DB-05 exception: the handler's own output, capped at resultMaxBytes. Handlers store owner-safe data only.
        result: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined,
            validate: cappedJson(
                JOB_LIMITS.resultMaxBytes,
                "JOB_RESULT_TOO_LARGE"
            ),
        },
        lastError: {
            code: {
                type: String,
                trim: true,
                lowercase: true,
                maxlength: 64,
            },
            message: {
                type: String,
                trim: true,
                maxlength: JOB_LIMITS.errorMessageMaxLength,
            },
        },
        // TTL clock, set only when the job reaches `done` or `failed` (DB-49: 30 days).
        expiresAt: { type: Date, default: undefined },
    },
    { timestamps: true, collection: "jobs" }
);

jobSchema.plugin(toJsonPlugin);

// serves: enqueue upsert and the duplicate check (same type and key is the same job)
jobSchema.index(
    { type: 1, idempotencyKey: 1 },
    { name: "jobs_type_idempotencyKey_uq", unique: true }
);
// serves: the worker claim (oldest queued job whose runAt has passed)
jobSchema.index({ status: 1, runAt: 1 }, { name: "jobs_status_runAt" });
// serves: recovery of running jobs whose lock expired
jobSchema.index(
    { status: 1, lockedUntil: 1 },
    { name: "jobs_status_lockedUntil" }
);
// serves: removal of finished jobs 30 days after they ended (TTL runs about 60 s late; reads never rely on it)
jobSchema.index(
    { expiresAt: 1 },
    {
        name: "jobs_expiresAt_ttl",
        expireAfterSeconds: 0,
        partialFilterExpression: { expiresAt: { $type: "date" } },
    }
);

export const Job = mongoose.model("Job", jobSchema);
