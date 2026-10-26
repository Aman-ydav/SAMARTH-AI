import { useSyncExternalStore } from "react";

function subscribe(onChange) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
}

const getSnapshot = () => navigator.onLine !== false;
const getServerSnapshot = () => true;

/** Live `navigator.onLine` (FE-42). */
export function useOnline() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
