import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { NotificationsMenuBody } from "@/features/notifications/components/NotificationsMenuBody";
import { useUnreadPolling } from "@/features/notifications/hooks/useUnreadPolling";
import {
    fetchRecentNotifications,
    selectUnreadCount,
} from "@/features/notifications/slice/notificationsSlice";

/**
 * The live bell: polls the unread count (`useUnreadPolling`), shows it on the badge and loads the five most recent
 * notifications each time the popover opens. The bell itself stays a presentational component of the shell.
 */
export function NotificationsMenu() {
    const dispatch = useAppDispatch();
    const unreadCount = useAppSelector(selectUnreadCount);
    useUnreadPolling();

    const handleOpenChange = useCallback(
        (open) => {
            if (open) dispatch(fetchRecentNotifications());
        },
        [dispatch]
    );

    return (
        <NotificationsBell
            unreadCount={unreadCount}
            onOpenChange={handleOpenChange}
        >
            {({ close }) => <NotificationsMenuBody onNavigate={close} />}
        </NotificationsBell>
    );
}
