import { HttpResponse } from "msw";
import { env } from "@/lib/env";

/** MSW path matching any origin, so tests run against the relative base URL. */
export const apiUrl = (path) => `*${env.apiUrl}${path}`;

/** Success envelope (charter section 5). */
export function okResponse(
    data = null,
    { status = 200, message = "OK", meta, headers } = {}
) {
    return HttpResponse.json(
        {
            statusCode: status,
            success: true,
            message,
            data,
            ...(meta ? { meta } : {}),
        },
        { status, headers }
    );
}

/** Error envelope with `requestId` (R35). */
export function errorResponse(
    status,
    code,
    {
        message = "Request failed",
        errors = [],
        requestId = "req-test-1",
        headers,
    } = {}
) {
    return HttpResponse.json(
        {
            statusCode: status,
            success: false,
            message,
            code,
            errors,
            data: null,
            requestId,
        },
        { status, headers }
    );
}

/** `meta` of a paged list (backend `PageMeta`). */
export function pageMeta({ page = 1, limit = 20, total = 0 } = {}) {
    const totalPages = Math.ceil(total / limit);
    return { page, limit, total, totalPages, hasNext: page < totalPages };
}
