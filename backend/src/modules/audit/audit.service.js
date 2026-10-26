import { DEFAULT_ORG_ID } from "#constants/org.js";
import { AUDIT_ACTION_LIST } from "#constants/auditActions.js";
import { withTransaction } from "#db/transaction.js";
import { sha256Hex } from "#utils/hash.js";
import { gte } from "#utils/mongoOps.js";
import {
    AUDIT_GENESIS_HASH,
    AUDIT_META_MAX_BYTES,
    AuditLog,
} from "./auditLog.model.js";
import { Counter } from "./counter.model.js";

const AUDIT_COUNTER_ID = "auditSeq";
const VERIFY_BATCH_SIZE = 500;
const FORBIDDEN_KEY = /password|token|secret|credential|cookie|authorization/i;
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** JSON with object keys sorted at every level, so the hash does not depend on key order (doc 10 section 5). */
export function canonicalJson(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value ?? null);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    const body = Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${body.join(",")}}`;
}

/** hash_n = SHA-256(seq | at | actorId | action | entityType | entityId | canonicalJSON(meta) | hash_{n-1}). */
export function computeAuditHash(entry) {
    return sha256Hex(
        [
            entry.seq,
            new Date(entry.at).toISOString(),
            entry.actorId ? String(entry.actorId) : "",
            entry.action,
            entry.entityType,
            entry.entityId ? String(entry.entityId) : "",
            canonicalJson(entry.meta ?? {}),
            entry.prevHash,
        ].join("|")
    );
}

// Programmer errors, not request errors: audit meta must never carry credentials, tokens or raw emails (AUTH-63).
function assertSafeMeta(meta) {
    const stack = [meta];
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === null || typeof current !== "object") {
            if (typeof current === "string" && EMAIL_SHAPE.test(current)) {
                throw new TypeError("Audit meta must not contain raw emails");
            }
            continue;
        }
        for (const [key, value] of Object.entries(current)) {
            if (FORBIDDEN_KEY.test(key)) {
                throw new TypeError(`Audit meta key "${key}" is not allowed`);
            }
            stack.push(value);
        }
    }
    if (Buffer.byteLength(canonicalJson(meta), "utf8") > AUDIT_META_MAX_BYTES) {
        throw new TypeError("Audit meta exceeds 4 KB");
    }
}

async function appendInSession(entry, session) {
    const counter = await Counter.findOneAndUpdate(
        { _id: AUDIT_COUNTER_ID },
        { $inc: { seq: 1 } },
        // Upsert inside the transaction: a counter created outside it would be invisible to the transaction snapshot.
        // Two first appends racing on the missing document conflict, and withTransaction retries the loser.
        { upsert: true, returnDocument: "after", session }
    );
    const { seq } = counter;
    let prevHash = AUDIT_GENESIS_HASH;
    if (seq > 1) {
        const previous = await AuditLog.findOne({ seq: seq - 1 })
            .session(session)
            .select("hash")
            .lean();
        if (!previous)
            throw new Error("Audit chain is broken: previous entry is missing");
        prevHash = previous.hash;
    }
    const complete = { ...entry, seq, prevHash };
    complete.hash = computeAuditHash(complete);
    const [saved] = await AuditLog.create([complete], { session });
    return saved;
}

/**
 * Appends one hash-chained audit entry (BE-64, doc 10 section 5). The sequence counter and the insert share one
 * transaction, so two concurrent appends can never fork the chain (DB-32). Pass `session` to join the caller's
 * transaction; otherwise a transaction is opened. `meta` is capped at 4 KB and must hold only hashes and flags.
 *
 * @param {{ actorId?: unknown, orgId?: unknown, action: string, entityType: string, entityId?: unknown, meta?: object }} event
 * @param {{ session?: import("mongoose").ClientSession, now?: Date }} [options]
 */
export async function appendAudit(
    {
        actorId = null,
        orgId = DEFAULT_ORG_ID,
        action,
        entityType,
        entityId = null,
        meta = {},
    },
    { session, now = new Date() } = {}
) {
    if (!AUDIT_ACTION_LIST.includes(action)) {
        throw new TypeError(`Unknown audit action "${action}"`);
    }
    assertSafeMeta(meta);
    const entry = {
        at: now,
        orgId,
        action,
        entityType,
        ...(actorId ? { actorId } : {}),
        ...(entityId ? { entityId } : {}),
        meta,
    };
    if (session) return appendInSession(entry, session);
    return withTransaction((own) => appendInSession(entry, own));
}

/**
 * Recomputes the whole chain in order. Returns `{ valid: true, count }`, or `{ valid: false, brokenAtSeq }` at the
 * first entry whose sequence, previous hash or own hash does not match.
 */
export async function verifyAuditChain({ batchSize = VERIFY_BATCH_SIZE } = {}) {
    let expectedSeq = 1;
    let expectedPrev = AUDIT_GENESIS_HASH;
    for (;;) {
        const batch = await AuditLog.find({ seq: gte(expectedSeq) })
            .sort({ seq: 1 })
            .limit(batchSize)
            .lean();
        if (batch.length === 0) break;
        for (const row of batch) {
            const intact =
                row.seq === expectedSeq &&
                row.prevHash === expectedPrev &&
                row.hash === computeAuditHash(row);
            if (!intact) return { valid: false, brokenAtSeq: row.seq };
            expectedPrev = row.hash;
            expectedSeq += 1;
        }
    }
    return { valid: true, count: expectedSeq - 1 };
}
