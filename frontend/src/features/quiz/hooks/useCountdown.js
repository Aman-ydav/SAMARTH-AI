import { useEffect, useRef, useState } from "react";

/**
 * Counts down to a wall-clock `deadline` (ms timestamp) so a throttled background tab cannot stretch the time.
 * Calls `onExpire` exactly once when it reaches zero. A null deadline means no limit.
 */
export function useCountdown(deadline, onExpire) {
    const [remaining, setRemaining] = useState(() =>
        deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null
    );
    const expired = useRef(false);
    const callback = useRef(onExpire);

    useEffect(() => {
        callback.current = onExpire;
    });

    useEffect(() => {
        if (!deadline) return undefined;
        expired.current = false;
        const tick = () => {
            const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setRemaining(left);
            if (left === 0 && !expired.current) {
                expired.current = true;
                callback.current?.();
            }
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [deadline]);

    return remaining;
}
