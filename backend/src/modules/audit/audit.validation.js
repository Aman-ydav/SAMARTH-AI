import { z } from "zod";
import { AUDIT_ACTION_LIST } from "#constants/auditActions.js";
import { paginationQueryShape } from "#utils/pagination.js";
import { TAMPER_DEMO } from "./audit.constants.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
// Full instants only (UTC or with an offset): a date without a time would make "to" ambiguous (EDGE-14).
const instant = z.iso.datetime({ offset: true });

/**
 * `GET /admin/audit`: standard paging plus the filters of doc 08 section 7.6. Unknown keys, unknown actions and bad ids are
 * a 400, never ignored (EDGE-43); `from` after `to` is refused.
 */
export const listAuditQuery = z
    .object({
        ...paginationQueryShape,
        actor: z.string().regex(OBJECT_ID_PATTERN).optional(),
        action: z.enum(AUDIT_ACTION_LIST).optional(),
        from: instant.optional(),
        to: instant.optional(),
    })
    .refine(
        (query) =>
            !query.from ||
            !query.to ||
            Date.parse(query.from) <= Date.parse(query.to),
        { message: "from must not be after to", path: ["from"] }
    );

export const emptyQuery = z.object({});

/** `POST /admin/audit/demo/tamper`: optionally choose which entry of the sampled window to alter. */
export const tamperBody = z.object({
    seq: z.number().int().min(1).max(TAMPER_DEMO.windowSize).optional(),
});
