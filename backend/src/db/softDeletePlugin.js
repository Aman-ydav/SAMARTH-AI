const FIND_HOOKS = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "countDocuments",
    "updateOne",
    "updateMany",
];

/**
 * Soft-delete plugin (DB-27, DB-28): adds `deletedAt` (default null) and hides deleted documents from queries
 * unless `.setOptions({ withDeleted: true })`. Aggregations are not covered: use scopeStage() there.
 */
export function softDeletePlugin(schema) {
    if (!schema.path("deletedAt"))
        schema.add({ deletedAt: { type: Date, default: null } });
    for (const hook of FIND_HOOKS) {
        schema.pre(hook, function hideDeleted() {
            if (this.getOptions().withDeleted) return;
            const filter = this.getFilter();
            if (!Object.hasOwn(filter, "deletedAt"))
                this.where({ deletedAt: null });
        });
    }
}
