const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The audit list is ordered by chain position; `seq` is unique and indexed (DB-20). */
export const AUDIT_SORT_FIELDS = Object.freeze(["seq"]);

/** Per-user limits (never multiplied in tests, R10). Verifying walks the whole chain, so it is the strictest. */
export const AUDIT_LIMITS = Object.freeze({
    read: { name: "audit-read", windowMs: 15 * MINUTE_MS, limit: 300 },
    verify: { name: "audit-verify", windowMs: HOUR_MS, limit: 30 },
    demo: { name: "audit-demo", windowMs: HOUR_MS, limit: 30 },
});

/**
 * The tamper demo checks the first `windowSize` entries of the chain. Starting at the genesis entry means the check begins
 * from a known state, and the window keeps the copy held in memory small (BE-25).
 */
export const TAMPER_DEMO = Object.freeze({ windowSize: 200, minEntries: 2 });
