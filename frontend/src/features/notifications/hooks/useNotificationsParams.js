import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { parseNotificationsQuery } from "@/features/notifications/schemas/notificationsSchemas";

/**
 * The URL owns page, limit and the unread filter of the notifications list (FE-26, FE-72). The search params are parsed into a
 * clamped query with defaults. `setQuery(patch)` writes the changed keys with `replace`, drops empty values and, unless the
 * patch names `page`, returns to the first page because the result set changed.
 */
export function useNotificationsParams() {
    const [searchParams, setSearchParams] = useSearchParams();
    const text = searchParams.toString();
    // Measured reason (FE-92): the fetch effect depends on the query object, so its identity must follow the URL text only.
    const query = useMemo(
        () => parseNotificationsQuery(new URLSearchParams(text)),
        [text]
    );

    const setQuery = useCallback(
        (patch) =>
            setSearchParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    for (const [key, value] of Object.entries(patch)) {
                        const empty =
                            value === undefined ||
                            value === null ||
                            value === "" ||
                            (key === "page" && Number(value) <= 1);
                        if (empty) next.delete(key);
                        else next.set(key, String(value));
                    }
                    if (!("page" in patch)) next.delete("page");
                    return next;
                },
                { replace: true }
            ),
        [setSearchParams]
    );

    return { query, setQuery };
}
