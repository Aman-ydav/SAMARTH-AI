import { useEffect, useState } from "react";

/** Returns `value` after it has stopped changing for `delayMs` (search inputs use 300 ms, FE-72). */
export function useDebounce(value, delayMs = 300) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}
