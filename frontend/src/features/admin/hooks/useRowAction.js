import { useCallback, useRef, useState } from "react";
import { notify } from "@/hooks/useNotify";
import { toApiError } from "@/lib/apiError";

/* Failures that mean "the row is not what the screen thought": the list is read again so it shows the truth. */
const STALE_STATUSES = new Set([404, 409, 422]);

/**
 * Runs one write on one row of a list (revoke, resend, suspend, ...). Only one runs at a time (FE-77); the id of the busy row is
 * exposed so its button can show a spinner while every other control is disabled. Success and failure each end in one
 * deduplicated toast (FE-107); a stale row (404, 409, 422) and every success trigger `onRefresh`.
 * `run(id, work, successText)` resolves `true` on success. `errorText(error)` supplies the failure text.
 */
export function useRowAction({ errorText, onRefresh }) {
    const [busyId, setBusyId] = useState(null);
    const inFlight = useRef(false);

    const run = useCallback(
        async (id, work, successText) => {
            if (inFlight.current) return false;
            inFlight.current = true;
            setBusyId(id);
            try {
                await work();
                await notify("success", successText, `admin-done-${id}`);
                onRefresh?.();
                return true;
            } catch (raw) {
                const error = toApiError(raw);
                await notify("error", errorText(error), "admin-failed");
                if (STALE_STATUSES.has(error.statusCode)) onRefresh?.();
                return false;
            } finally {
                inFlight.current = false;
                setBusyId(null);
            }
        },
        [errorText, onRefresh]
    );

    return { busyId, run };
}
