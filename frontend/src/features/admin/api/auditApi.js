import { readMeta } from "@/features/admin/api/adminApi";
import { apiClient } from "@/lib/apiClient";

/*
 * Audit trail (doc 08 section 6.4). Every function takes `(args, { signal })` and returns unwrapped data: `{ items, meta }`
 * for the list, the chain status for verify, the simulation outcome for the tamper demo (FE-39). Each reader is defensive
 * (FE-37): a response that is not shaped as expected becomes `null`, which the slice turns into `INVALID_RESPONSE`.
 */

const text = (value) => (typeof value === "string" ? value : "");
const textOrNull = (value) =>
    typeof value === "string" && value ? value : null;
const integerOrNull = (value) =>
    Number.isInteger(value) && value >= 0 ? value : null;

/** Drops empty values so the URL stays minimal and the strict server schema never sees an empty filter. */
function cleanParams(params) {
    const clean = {};
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "")
            clean[key] = value;
    }
    return clean;
}

/** One audit entry. `meta` holds only hashes and flags (the server refuses anything else), shown as plain data. */
export function readAuditEntry(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
        return null;
    return {
        id: raw.id,
        seq: integerOrNull(raw.seq) ?? 0,
        at: textOrNull(raw.at),
        actorId: textOrNull(raw.actorId),
        orgId: textOrNull(raw.orgId),
        action: text(raw.action),
        entityType: text(raw.entityType),
        entityId: textOrNull(raw.entityId),
        prevHash: text(raw.prevHash),
        hash: text(raw.hash),
    };
}

/** Result of the real chain check. `count` is set when intact, `brokenAtSeq` when not. */
export function readChainStatus(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.valid !== "boolean")
        return null;
    return {
        valid: raw.valid,
        count: integerOrNull(raw.count),
        brokenAtSeq: integerOrNull(raw.brokenAtSeq),
        verifiedAt: textOrNull(raw.verifiedAt),
        tamperDemoEnabled: raw.tamperDemoEnabled === true,
    };
}

const readOutcome = (raw) => ({
    valid: raw?.valid === true,
    brokenAtSeq: integerOrNull(raw?.brokenAtSeq),
});

/** Outcome of the tamper simulation: the check before and after altering one entry in a copy. */
export function readSimulation(raw) {
    if (
        !raw ||
        typeof raw !== "object" ||
        !raw.before ||
        !raw.after ||
        !Number.isInteger(raw.tamperedSeq)
    )
        return null;
    return {
        windowSize: integerOrNull(raw.windowSize) ?? 0,
        tamperedSeq: raw.tamperedSeq,
        before: readOutcome(raw.before),
        after: readOutcome(raw.after),
        detected: raw.detected === true,
    };
}

/** `GET /admin/audit`: newest first; `query` is `{ page, limit, action, from, to }`. */
export async function listEntries(query, { signal } = {}) {
    const { data, meta } = await apiClient.get("/admin/audit", {
        params: cleanParams(query),
        signal,
    });
    const rows = Array.isArray(data?.entries) ? data.entries : [];
    return {
        items: rows.map(readAuditEntry).filter(Boolean),
        meta: readMeta(meta),
    };
}

/** `GET /admin/audit/verify` (platform admin): recomputes the whole chain. */
export async function verifyChain({ signal } = {}) {
    const { data } = await apiClient.get("/admin/audit/verify", { signal });
    return readChainStatus(data?.chain);
}

/** `POST /admin/audit/demo/tamper` (platform admin, demo switch on): `seq` is optional. */
export async function simulateTamper({ seq } = {}, { signal } = {}) {
    const { data } = await apiClient.post(
        "/admin/audit/demo/tamper",
        seq === undefined ? {} : { seq },
        { signal }
    );
    return readSimulation(data?.simulation);
}
