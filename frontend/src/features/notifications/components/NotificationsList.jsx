import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { NotificationsEmptyState } from "@/features/notifications/components/NotificationsEmptyState";
import { NotificationsPagination } from "@/features/notifications/components/NotificationsPagination";
import { NotificationsSkeleton } from "@/features/notifications/components/NotificationsSkeleton";
import {
    selectNotificationList,
    selectNotificationsError,
    selectNotificationsMeta,
    selectNotificationsStatus,
    selectPendingIds,
} from "@/features/notifications/slice/notificationsSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * The list of the notifications page with its four states (FE-93): skeleton only while there is nothing to show yet, an
 * error with Retry, an empty state (with a way out of the unread filter), and the rows with paging. Revalidation keeps the old
 * rows on screen. A page past the last one (for example after dismissing the final row of a page) moves back to the last page (FE-26).
 */
export function NotificationsList({ query, setQuery, onRefresh }) {
    const { t } = useTranslation("notifications");
    const items = useAppSelector(selectNotificationList);
    const status = useAppSelector(selectNotificationsStatus);
    const error = useAppSelector(selectNotificationsError);
    const meta = useAppSelector(selectNotificationsMeta);
    const pendingIds = useAppSelector(selectPendingIds);

    const pastLastPage =
        status === STATUS.SUCCEEDED &&
        meta.totalPages > 0 &&
        query.page > meta.totalPages;
    useEffect(() => {
        if (pastLastPage) setQuery({ page: meta.totalPages });
    }, [pastLastPage, meta.totalPages, setQuery]);

    if (items.length === 0) {
        if (status === STATUS.FAILED)
            return <LoadErrorAlert error={error} onRetry={onRefresh} />;
        if (status !== STATUS.SUCCEEDED || pastLastPage)
            return <NotificationsSkeleton />;
        return (
            <NotificationsEmptyState
                filtered={query.unread === "true"}
                onShowAll={() => setQuery({ unread: undefined })}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <ul
                aria-label={t("page.title")}
                className="flex flex-col rounded-lg border border-border"
            >
                {items.map((notification) => (
                    <NotificationRow
                        key={notification.id}
                        notification={notification}
                        pending={pendingIds.includes(notification.id)}
                    />
                ))}
            </ul>
            <NotificationsPagination
                meta={meta}
                disabled={status === STATUS.LOADING}
                onPageChange={(page) => setQuery({ page })}
            />
        </div>
    );
}
