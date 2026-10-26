/**
 * Shared `toJSON` plugin (DB-13): `_id` becomes `id`, `__v` and every `select: false` path are removed.
 * Lean results are not transformed, so services still map them through a `toPublic<Name>` function.
 */
export function toJsonPlugin(schema) {
    const secretPaths = [];
    schema.eachPath((path, type) => {
        if (type.options?.select === false) secretPaths.push(path);
    });
    schema.set("toJSON", {
        virtuals: false,
        versionKey: false,
        transform(_doc, ret) {
            ret.id = String(ret._id);
            delete ret._id;
            delete ret.__v;
            for (const path of secretPaths) delete ret[path];
            return ret;
        },
    });
}
