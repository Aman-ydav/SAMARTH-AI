import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { CheckIcon, SpinnerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useNotificationActions } from "@/features/notifications/hooks/useNotificationActions";
import {
    selectMarkAllReadStatus,
    selectUnreadCount,
} from "@/features/notifications/slice/notificationsSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * "Mark all as read" for the page and the bell. It is disabled when nothing is unread or while the request runs (no
 * double submit, EDGE-30); the label stays and a spinner replaces the icon (UI-50). `scope` picks the wording: `page` for
 * the notifications screen, `menu` for the bell.
 */
export function MarkAllReadButton({ scope = "page", size = "sm" }) {
    const { t } = useTranslation("notifications");
    const unreadCount = useAppSelector(selectUnreadCount);
    const status = useAppSelector(selectMarkAllReadStatus);
    const { markAllRead } = useNotificationActions();
    const busy = status === STATUS.LOADING;

    return (
        <Button
            type="button"
            variant="outline"
            size={size}
            disabled={unreadCount === 0 || busy}
            aria-busy={busy}
            onClick={() => markAllRead()}
        >
            {busy ? (
                <SpinnerIcon
                    className="motion-safe:animate-spin"
                    aria-hidden="true"
                />
            ) : (
                <CheckIcon aria-hidden="true" />
            )}
            {scope === "menu" ? t("menu.markAllRead") : t("page.markAllRead")}
        </Button>
    );
}
