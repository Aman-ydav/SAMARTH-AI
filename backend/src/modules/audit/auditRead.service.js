import { ROLES } from "#constants/roles.js";
import { toObjectId } from "#utils/mongo.js";
import { gte, lte } from "#utils/mongoOps.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { AUDIT_SORT_FIELDS } from "./audit.constants.js";
import { verifyAuditChain } from "./audit.service.js";
import { AuditLog } from "./auditLog.model.js";

/**
 * The audit entry as the admin screens see it (BE-47). `meta` holds only hashes and flags by construction (the service
 * refuses anything else when the entry is written), so it is shown as stored. Only a platform admin sees `orgId`.
 */
export function toPublicAuditEntry(row, { includeOrg = false } = {}) {
    return {
        id: String(row._id),
        seq: row.seq,
        at: row.at,
        actorId: row.actorId ? String(row.actorId) : null,
        ...(includeOrg ? { orgId: String(row.orgId) } : {}),
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId ? String(row.entityId) : null,
        meta: row.meta ?? {},
        prevHash: row.prevHash,
        hash: row.hash,
    };
}

/**
 * Newest entry first. An admin sees only the entries of their own organisation, taken from the session, never from the
 * request (BE-43); a platform admin sees every organisation. The date range is `$and` of two trusted conditions because
 * both bounds sit on `at` (BE-62).
 */
export async function listAuditEntries({ role, orgId, query }) {
    const page = parsePagination(query, {
        allowedSort: AUDIT_SORT_FIELDS,
        defaultSort: "seq",
        defaultOrder: "desc",
    });
    const platformWide = role === ROLES.SUPERADMIN;
    const filter = {};
    if (!platformWide) filter.orgId = toObjectId(orgId, "orgId");
    if (query.actor) filter.actorId = toObjectId(query.actor, "actor");
    if (query.action) filter.action = query.action;
    const range = [];
    if (query.from) range.push({ at: gte(new Date(query.from)) });
    if (query.to) range.push({ at: lte(new Date(query.to)) });
    if (range.length > 0) filter.$and = range;

    const [rows, total] = await Promise.all([
        AuditLog.find(filter)
            .sort(page.sort)
            .skip(page.skip)
            .limit(page.limit)
            .lean(),
        AuditLog.countDocuments(filter),
    ]);
    return {
        items: rows.map((row) =>
            toPublicAuditEntry(row, { includeOrg: platformWide })
        ),
        meta: buildPageMeta({ page: page.page, limit: page.limit, total }),
    };
}

/**
 * The real integrity check of the whole chain plus the time it ran and whether the tamper demo is switched on, so the
 * screen knows whether to offer the demo. The chain is global across organisations, so only a platform admin reaches this.
 */
export async function getChainStatus({ tamperDemoEnabled, now = new Date() }) {
    const result = await verifyAuditChain();
    return {
        ...result,
        verifiedAt: now.toISOString(),
        tamperDemoEnabled,
    };
}
