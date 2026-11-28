import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { BellIcon } from "@/components/icons";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { MarkAllReadButton } from "@/features/notifications/components/MarkAllReadButton";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { NotificationsSkeleton } from "@/features/notifications/components/NotificationsSkeleton";
import {
    fetchRecentNotifications,
    selectPendingIds,
    selectRecentError,
    selectRecentNotifications,
    selectRecentStatus,
    selectUnreadCount,
} from "@/features/notifications/slice/notificationsSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * Body of the bell's popover with the four states (FE-93): skeleton while the first read runs, an error with Retry when it
 * failed and there is nothing to show, the empty state, and the list. Revalidation keeps showing the old rows. The empty
 * wording is the bell's own (`nav` namespace, bundled); rows and the mark-all button load the lazy `notifications`
 * namespace inside their own Suspense, so the top bar never suspends (FE-82).
 */
export function NotificationsMenuBody({ onNavigate }) {
    const { t } = useTranslation("nav");
    const dispatch = useAppDispatch();
    const items = useAppSelector(selectRecentNotifications);
    const status = useAppSelector(selectRecentStatus);
    const error = useAppSelector(selectRecentError);
    const unreadCount = useAppSelector(selectUnreadCount);
    const pendingIds = useAppSelector(selectPendingIds);

    if (items.length === 0) {
        if (status === STATUS.FAILED)
            return (
                <LoadErrorAlert
                    error={error}
                    onRetry={() => dispatch(fetchRecentNotifications())}
                />
            );
        if (status !== STATUS.SUCCEEDED)
            return <NotificationsSkeleton rows={3} />;
        return (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
                <BellIcon
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                />
                <p className="font-medium text-foreground">
                    {t("notifications.emptyTitle")}
                </p>
                <p className="text-muted-foreground">
                    {t("notifications.emptyBody")}
                </p>
            </div>
        );
    }

    return (
        <Suspense fallback={<NotificationsSkeleton rows={3} />}>
            {unreadCount > 0 && (
                <div className="flex justify-end">
                    <MarkAllReadButton scope="menu" />
                </div>
            )}
            <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto rounded-md border border-border">
                {items.map((notification) => (
                    <NotificationRow
                        key={notification.id}
                        notification={notification}
                        variant="menu"
                        pending={pendingIds.includes(notification.id)}
                        onNavigate={onNavigate}
                    />
                ))}
            </ul>
        </Suspense>
    );
}
