import { z } from "zod";
import { ApiError } from "#utils/apiError.js";
import { asyncHandler } from "#utils/asyncHandler.js";

const PARTS = ["params", "query", "body"];
const MAX_MESSAGE = 200;

/**
 * Unknown keys are rejected by default (BE-23, doc 08: so `role`, `orgId` or `status` in a body are refused, not ignored).
 * A schema that already chose `.strip()`, `z.looseObject` or `z.strictObject` explicitly is left alone.
 */
function withUnknownKeyPolicy(schema, mode) {
    const isPlainObject =
        schema instanceof z.ZodObject && schema._zod.def.catchall === undefined;
    return mode === "strict" && isPlainObject ? schema.strict() : schema;
}

function toFieldErrors(part, issues) {
    const prefix = part === "body" ? [] : [part];
    return issues.flatMap((issue) => {
        if (issue.code === "unrecognized_keys") {
            return issue.keys.map((key) => ({
                field: [...prefix, ...issue.path, key].join("."),
                message: "Unknown field",
                code: issue.code,
            }));
        }
        return [
            {
                field: [...prefix, ...issue.path].join(".") || part,
                message: issue.message.slice(0, MAX_MESSAGE),
                code: issue.code,
            },
        ];
    });
}

/**
 * Validates `params`, `query` and `body` with Zod (BE-23). On success the parsed, coerced values are on `req.validated`
 * (`req.query` is read-only in Express 5 and `req.body` is replaced by the parsed copy). On failure it raises
 * 400 VALIDATION_ERROR with one entry per problem; field names of query/params are prefixed (`query.page`). Submitted
 * values are never echoed.
 *
 * @param {{ params?: z.ZodType, query?: z.ZodType, body?: z.ZodType }} schemas
 * @param {{ unknownKeys?: "strict" | "strip" }} [options]
 */
export function validate(schemas, { unknownKeys = "strict" } = {}) {
    return asyncHandler(async (req, _res, next) => {
        const validated = {};
        const errors = [];
        for (const part of PARTS) {
            if (!schemas[part]) continue;
            const schema = withUnknownKeyPolicy(schemas[part], unknownKeys);
            const result = await schema.safeParseAsync(req[part] ?? {});
            if (result.success) validated[part] = result.data;
            else errors.push(...toFieldErrors(part, result.error.issues));
        }
        if (errors.length > 0) throw ApiError.validation(errors);
        req.validated = validated;
        if (validated.body !== undefined) req.body = validated.body;
        next();
    });
}
