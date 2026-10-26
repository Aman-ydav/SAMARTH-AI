import { z } from "zod";
import { ApiError } from "./apiError.js";

export const PAGINATION = Object.freeze({
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MAX_SKIP: 10_000,
});

/** Zod shape for the standard list query. Spread it into an endpoint's query schema; parsePagination does the clamping. */
export const paginationQueryShape = Object.freeze({
    page: z.string().max(10).optional(),
    limit: z.string().max(10).optional(),
    sort: z.string().max(40).optional(),
    order: z.string().max(4).optional(),
});

const toPositiveInt = (raw, fallback) => {
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 ? value : fallback;
};

const invalid = (field, message) =>
    ApiError.validation([{ field, message, code: "invalid_enum_value" }]);

/**
 * Parses page, limit, sort and order (BE-25). Bad page/limit fall back to defaults and limit is capped (EDGE-42);
 * a sort field outside the whitelist or an order other than asc/desc is a 400 (rule 09 section 5).
 * `allowedSort` is a list of fields or a `{ publicName: dbField }` map. `_id` is always added as a stable tiebreaker.
 */
export function parsePagination(
    query = {},
    {
        allowedSort = [],
        defaultSort = "createdAt",
        defaultOrder = "desc",
        maxLimit = PAGINATION.MAX_LIMIT,
    } = {}
) {
    const sortMap = Array.isArray(allowedSort)
        ? Object.fromEntries(allowedSort.map((field) => [field, field]))
        : allowedSort;
    const page = toPositiveInt(query.page, 1);
    const limit = Math.min(
        toPositiveInt(query.limit, PAGINATION.DEFAULT_LIMIT),
        maxLimit
    );

    const requested = query.sort ?? defaultSort;
    if (
        !Object.hasOwn(sortMap, requested) &&
        !(query.sort === undefined && requested === defaultSort)
    ) {
        throw invalid("sort", "Unsupported sort field");
    }
    const order = query.order ?? defaultOrder;
    if (order !== "asc" && order !== "desc")
        throw invalid("order", "Order must be asc or desc");

    const skip = (page - 1) * limit;
    if (skip > PAGINATION.MAX_SKIP)
        throw invalid(
            "page",
            "Page is too deep: narrow the search with filters"
        );

    const sortField = sortMap[requested] ?? requested;
    const direction = order === "asc" ? 1 : -1;
    return {
        page,
        limit,
        skip,
        sortField,
        order,
        sort: { [sortField]: direction, _id: direction },
    };
}

/** Builds the `meta` block: page, limit, total, totalPages, hasNext. */
export function buildPageMeta({ page, limit, total }) {
    const totalPages = Math.ceil(total / limit);
    return { page, limit, total, totalPages, hasNext: page < totalPages };
}
