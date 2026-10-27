import { useCallback, useRef, useState } from "react";
import { API_ERROR_CODES, toApiError } from "@/lib/apiError";
import { useCountdown } from "@/hooks/useCountdown";

const REQUEST_ID_STATUS = 500;

/** Failure shown above a submit button: only plain, serialisable facts, never raw messages (FE-108). */
function toFailure(error) {
    const showsRequestId =
        error.statusCode >= REQUEST_ID_STATUS ||
        error.code === API_ERROR_CODES.INVALID_RESPONSE;
    return {
        code: error.code,
        requestId: showsRequestId ? error.requestId : null,
        retryAfterSec: error.retryAfterSec,
    };
}

/**
 * Runs one user-triggered async action (a thunk call) with a hard double-submit guard (FE-77), a pending flag
 * for disabling controls, and a normalised failure for the form-level alert. A 429 starts a countdown from its
 * `retryAfterSec` (FE-47). `run(action, onError)`: `onError(apiError)` returns `true` when it handled the error.
 */
export function useAsyncAction() {
    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState(null);
    const inFlight = useRef(false);
    const cooldown = useCountdown();
    const { startFor } = cooldown;

    const fail = useCallback(
        (error) => {
            setFailure(toFailure(error));
            if (
                error.code === API_ERROR_CODES.RATE_LIMITED &&
                error.retryAfterSec > 0
            )
                startFor(error.retryAfterSec);
        },
        [startFor]
    );

    const clearFailure = useCallback(() => setFailure(null), []);

    const run = useCallback(
        async (action, onError) => {
            if (inFlight.current) return undefined;
            inFlight.current = true;
            setFailure(null);
            setPending(true);
            try {
                return await action();
            } catch (raw) {
                const error = toApiError(raw);
                if (!onError?.(error)) fail(error);
                return undefined;
            } finally {
                inFlight.current = false;
                setPending(false);
            }
        },
        [fail]
    );

    return {
        run,
        pending,
        failure,
        fail,
        clearFailure,
        cooldownSec: cooldown.remainingSec,
    };
}
