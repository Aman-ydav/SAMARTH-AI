import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import {
    dismissNotification,
    fetchUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/features/notifications/slice/notificationsSlice";
import { useNotify } from "@/hooks/useNotify";
import {
    API_ERROR_CODES,
    errorMessageKey,
    isCanceledError,
} from "@/lib/apiError";

const TOAST_ID = "notifications-action";

/**
 * Mark read, mark all read and dismiss for the page and the bell (FE-34): each awaits `unwrap()` in a try/catch, then either
 * re-reads the unread count (so the badge and the server agree) or shows one deduplicated error toast (FE-107). Text comes from
 * `errors:codes.<CODE>` except for a notification that no longer exists, which has its own sentence. Server messages are never shown.
 */
export function useNotificationActions() {
    const dispatch = useAppDispatch();
    const { t } = useTranslation(["notifications", "errors"]);
    const notify = useNotify();

    const textFor = useCallback(
        (error) =>
            error?.code === API_ERROR_CODES.NOT_FOUND
                ? t("notifications:errors.notFound")
                : t(errorMessageKey(error?.code), {
                      defaultValue: t("errors:codes.UNKNOWN"),
                  }),
        [t]
    );

    const run = useCallback(
        async (action) => {
            try {
                await action().unwrap();
                dispatch(fetchUnreadCount({ force: true }));
                return true;
            } catch (error) {
                if (!isCanceledError(error))
                    notify("error", textFor(error), TOAST_ID);
                return false;
            }
        },
        [dispatch, notify, textFor]
    );

    const markRead = useCallback(
        (id) => run(() => dispatch(markNotificationRead(id))),
        [dispatch, run]
    );
    const markAllRead = useCallback(
        () => run(() => dispatch(markAllNotificationsRead())),
        [dispatch, run]
    );
    const dismiss = useCallback(
        (id) => run(() => dispatch(dismissNotification(id))),
        [dispatch, run]
    );

    return { markRead, markAllRead, dismiss };
}
