import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { TAMPER_DEMO } from "./audit.constants.js";
import { checkChainSegment } from "./audit.service.js";
import { AuditLog } from "./auditLog.model.js";

const outcomeOf = (result) =>
    result.valid
        ? { valid: true }
        : { valid: false, brokenAtSeq: result.brokenAtSeq };

/**
 * Shows how the hash chain catches tampering, WITHOUT touching it. It reads the first entries of the chain, checks them
 * as they are, then checks a copy in which ONE entry's `meta` is altered, and reports where the check breaks. Nothing is
 * ever written: the rows are read-only copies and the alteration lives only in this function. It runs the same
 * `checkChainSegment` as the real verification, so "detected" is the real check, not a staged message. The audit model
 * is append-only anyway (updates and deletes throw).
 *
 * @param {{ seq?: number, windowSize?: number }} [options] `seq` picks the entry to alter (default: the middle of the window)
 * @returns {Promise<{ windowSize: number, tamperedSeq: number, before: object, after: object, detected: boolean }>}
 */
export async function simulateTamper({
    seq,
    windowSize = TAMPER_DEMO.windowSize,
} = {}) {
    const rows = await AuditLog.find({})
        .sort({ seq: 1 })
        .limit(windowSize)
        .lean();
    if (rows.length < TAMPER_DEMO.minEntries)
        throw ApiError.unprocessable(ERROR_CODES.UNPROCESSABLE);
    const index =
        seq === undefined
            ? Math.floor(rows.length / 2)
            : rows.findIndex((row) => row.seq === seq);
    // A `seq` beyond the sampled window (or a gap) has no entry to alter.
    if (index < 0) throw ApiError.unprocessable(ERROR_CODES.UNPROCESSABLE);

    const target = rows[index];
    const before = checkChainSegment(rows);
    // Shallow copies only: rows hold ObjectIds and Dates, which a deep clone would turn into plain objects and break the hash.
    const altered = rows.map((row, position) =>
        position === index
            ? { ...row, meta: { ...(row.meta ?? {}), tampered: true } }
            : row
    );
    const after = checkChainSegment(altered);
    return {
        windowSize: rows.length,
        tamperedSeq: target.seq,
        before: outcomeOf(before),
        after: outcomeOf(after),
        detected:
            before.valid && !after.valid && after.brokenAtSeq === target.seq,
    };
}
