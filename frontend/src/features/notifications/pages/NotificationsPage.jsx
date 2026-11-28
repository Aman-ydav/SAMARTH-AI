import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { NotificationsList } from "@/features/notifications/components/NotificationsList";
import { NotificationsToolbar } from "@/features/notifications/components/NotificationsToolbar";
import { useNotificationsParams } from "@/features/notifications/hooks/useNotificationsParams";
import {
    fetchNotifications,
    fetchUnreadCount,
} from "@/features/notifications/slice/notificationsSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useRevalidateOnFocus } from "@/hooks/useRevalidateOnFocus";

// Notifications are never cached (TTL 0), so coming back to the tab after a minute reads them again (FE-24, FE-60).
const REVALIDATE_AFTER_MS = 60_000;

/**
 * `/notifications` (doc 22): every in-app notification of the signed-in user, newest first, with an unread filter, paging,
 * "mark as read", "mark all as read" and "dismiss". The URL owns page, limit and filter (FE-26). Open to every signed-in role.
 */
export default function NotificationsPage() {
    const { t } = useTranslation(["notifications", "common"]);
    const dispatch = useAppDispatch();
    const { query, setQuery } = useNotificationsParams();

    useDocumentTitle(
        t("common:documentTitle", { page: t("notifications:page.title") })
    );

    useEffect(() => {
        dispatch(fetchNotifications(query));
    }, [dispatch, query]);

    const refresh = useCallback(() => {
        dispatch(fetchNotifications({ ...query, force: true }));
        dispatch(fetchUnreadCount({ force: true }));
    }, [dispatch, query]);

    useRevalidateOnFocus(refresh, { minIdleMs: REVALIDATE_AFTER_MS });

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-6 outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">
                    {t("notifications:page.title")}
                </h1>
                <p className="type-body max-w-prose text-muted-foreground">
                    {t("notifications:page.subtitle")}
                </p>
            </header>
            <NotificationsToolbar query={query} setQuery={setQuery} />
            <NotificationsList
                query={query}
                setQuery={setQuery}
                onRefresh={refresh}
            />
        </main>
    );
}
