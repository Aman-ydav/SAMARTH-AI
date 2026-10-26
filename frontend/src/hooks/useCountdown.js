import { useCallback, useState, useSyncExternalStore } from "react";

const TICK_MS = 250;
const secondsLeft = (deadline) =>
    deadline === null
        ? 0
        : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * Countdown driven by an absolute deadline in epoch ms, never by chained timeouts (FE-81).
 * Pass an initial deadline (for example `lockout.until`) or call `startFor(seconds)` for cooldowns.
 */
export function useCountdown(initialDeadline = null) {
    const [state, setState] = useState({
        source: initialDeadline,
        deadline: initialDeadline,
    });
    if (state.source !== initialDeadline)
        setState({ source: initialDeadline, deadline: initialDeadline });
    const { deadline } = state;

    const subscribe = useCallback(
        (notify) => {
            if (deadline === null) return () => {};
            const timer = setInterval(() => {
                notify();
                if (secondsLeft(deadline) === 0) clearInterval(timer);
            }, TICK_MS);
            return () => clearInterval(timer);
        },
        [deadline]
    );
    const remainingSec = useSyncExternalStore(
        subscribe,
        () => secondsLeft(deadline),
        () => 0
    );

    const startFor = useCallback((seconds) => {
        const next = Date.now() + Math.max(0, Number(seconds) || 0) * 1000;
        setState((previous) => ({ ...previous, deadline: next }));
    }, []);
    const reset = useCallback(
        () => setState((previous) => ({ ...previous, deadline: null })),
        []
    );

    return { remainingSec, isRunning: remainingSec > 0, startFor, reset };
}
