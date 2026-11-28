import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
// The API refuses a skip over 10 000 (rule 05 DB-60); with the largest page size, page 100 is the deepest one it accepts.
const MAX_PAGE = 100;

const page = z.coerce.number().int().min(1).max(MAX_PAGE).catch(1);
const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE);

const querySchema = z.object({
    page,
    limit,
    // The screen only filters to unread; "all" is the absence of the key.
    unread: z.enum(["true"]).optional().catch(undefined),
});

/** List parameters from a `URLSearchParams`, with defaults and clamps (FE-72): hostile input falls back to the defaults. */
export const parseNotificationsQuery = (params) =>
    querySchema.parse(
        Object.fromEntries(
            params instanceof URLSearchParams ? params.entries() : []
        )
    );

/** Stable cache key of a parsed query (FE-25). */
export const queryKeyOf = (query) =>
    JSON.stringify(
        Object.keys(query)
            .sort()
            .map((key) => [key, query[key] ?? null])
    );
