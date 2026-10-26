/**
 * Runs an aggregation with a forced `maxTimeMS` (DB-56). Interactive defaults: 5000 ms, no disk use.
 * Jobs and reports pass `{ maxTimeMS: 30000, allowDiskUse: true }` and say why in a comment.
 */
export async function runAggregate(
    Model,
    pipeline,
    { maxTimeMS = 5000, allowDiskUse = false, session } = {}
) {
    const query = Model.aggregate(pipeline).option({ maxTimeMS, allowDiskUse });
    if (session) query.session(session);
    return query.exec();
}

/**
 * First `$match` of every tenant pipeline (DB-59): scopes by org and hides soft-deleted documents.
 * Aggregations bypass query middleware, so this stage is how DB-28 reaches pipelines.
 */
export function scopeStage({ orgId, includeDeleted = false, extra = {} }) {
    const match = { orgId, ...extra };
    if (!includeDeleted) match.deletedAt = null;
    return { $match: match };
}
