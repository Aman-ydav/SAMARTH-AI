import { useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { fetchUnreadCount } from "@/features/notifications/slice/notificationsSlice";
import { useOnline } from "@/hooks/useOnline";

// About once a minute per open tab (doc 22 section 3); the read limit of the API allows far more.
export const POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the bell's unread count fresh: one read on mount, then every minute while the tab is visible and the browser is
 * online. A hidden tab stops asking and asks again the moment it becomes visible; going back online reads at once (FE-42).
 * Failures are silent here (the count keeps its last value); a session that really ended is handled by the apiClient.
 * Effect cleanup only clears the timer and the listener, it never aborts a thunk (FE-33).
 */
export function useUnreadPolling() {
    const dispatch = useAppDispatch();
    const online = useOnline();

    useEffect(() => {
        if (!online) return undefined;
        const poll = () => {
            if (document.visibilityState === "visible")
                dispatch(fetchUnreadCount());
        };
        poll();
        const timer = setInterval(poll, POLL_INTERVAL_MS);
        document.addEventListener("visibilitychange", poll);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", poll);
        };
    }, [dispatch, online]);
}
