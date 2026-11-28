import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CheckIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useNotificationActions } from "@/features/notifications/hooks/useNotificationActions";
import { useNotificationText } from "@/features/notifications/hooks/useNotificationText";
import { formatRelativeTime } from "@/lib/format";
import { safeReturnPath } from "@/lib/safeRedirect";
import { cn } from "@/lib/utils";

/**
 * One notification. Two layouts share it: `page` (the full list: text, a "mark as read" and a "dismiss" button) and `menu`
 * (the bell's compact list: the text itself is the control). The wording comes from the notification `type` in the user's
 * language. A server-supplied `link` is only used when it is a real in-app path (`safeReturnPath`, FE-56). Opening an unread
 * notification marks it read. Unread rows carry a dot, a heavier title and a hidden "Unread" label (never colour alone, UI-07).
 */
export function NotificationRow({
    notification,
    variant = "page",
    pending = false,
    onNavigate,
}) {
    const { t, i18n } = useTranslation("notifications");
    const { markRead, dismiss } = useNotificationActions();
    const { title, body } = useNotificationText(notification);
    const unread = !notification.read;
    const to = notification.link
        ? safeReturnPath(notification.link, null)
        : null;
    const isPage = variant === "page";

    const open = () => {
        if (unread) markRead(notification.id);
        onNavigate?.();
    };

    const text = (
        <span className="flex min-w-0 flex-col gap-0.5 text-start">
            <span className="flex items-center gap-2">
                {unread && (
                    <>
                        <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full bg-primary"
                        />
                        <span className="sr-only">{t("row.unread")}</span>
                    </>
                )}
                <span
                    className={cn(
                        "text-sm text-foreground",
                        unread && "font-medium"
                    )}
                >
                    {title}
                </span>
            </span>
            <span className="text-sm text-muted-foreground">{body}</span>
            {notification.createdAt && (
                <time
                    dateTime={notification.createdAt}
                    className="type-caption text-muted-foreground"
                >
                    {formatRelativeTime(notification.createdAt, i18n.language)}
                </time>
            )}
        </span>
    );

    let main = text;
    if (to) {
        main = (
            <Link to={to} onClick={open} className="block">
                {text}
            </Link>
        );
    } else if (unread && !isPage) {
        main = (
            <Button
                type="button"
                variant="ghost"
                onClick={open}
                className="h-auto w-full justify-start px-0 py-0 font-normal whitespace-normal hover:bg-transparent"
            >
                {text}
            </Button>
        );
    }

    return (
        <li
            className={cn(
                "flex items-start gap-3 border-b border-border p-3 last:border-b-0",
                isPage && "p-4",
                unread && "bg-accent/50"
            )}
        >
            <div className="min-w-0 flex-1">{main}</div>
            {isPage && (
                <div className="flex shrink-0 items-center gap-1">
                    {unread && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={t("row.markRead")}
                            onClick={() => markRead(notification.id)}
                        >
                            <CheckIcon className="size-4" aria-hidden="true" />
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        aria-label={t("row.dismiss")}
                        onClick={() => dismiss(notification.id)}
                    >
                        <TrashIcon className="size-4" aria-hidden="true" />
                    </Button>
                </div>
            )}
        </li>
    );
}
