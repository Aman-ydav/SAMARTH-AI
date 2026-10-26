import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BellIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover";
import { formatNumber } from "@/lib/format";
import { PATHS } from "@/lib/paths";

const MAX_BADGE = 99;

/**
 * Bell with an unread-count badge (capped at 99+) opening a popover list (UI-61). There is no notifications source
 * yet, so the list is the empty state; `unreadCount` is the seam for the future notifications slice.
 */
export function NotificationsBell({ unreadCount = 0 }) {
    const { t, i18n } = useTranslation("nav");
    const count =
        Number.isFinite(unreadCount) && unreadCount > 0
            ? Math.floor(unreadCount)
            : 0;
    const badge =
        count > MAX_BADGE
            ? t("notifications.overflow")
            : formatNumber(count, i18n.language);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={
                        count > 0
                            ? t("notifications.labelUnread", { count })
                            : t("notifications.label")
                    }
                >
                    <BellIcon className="size-5" aria-hidden="true" />
                    {count > 0 ? (
                        <Badge
                            aria-hidden="true"
                            className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 tabular-nums"
                        >
                            {badge}
                        </Badge>
                    ) : null}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-80"
                aria-label={t("notifications.title")}
            >
                <PopoverHeader>
                    <PopoverTitle>{t("notifications.title")}</PopoverTitle>
                </PopoverHeader>
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
                <Button variant="outline" asChild>
                    <Link to={PATHS.notifications}>
                        {t("notifications.viewAll")}
                    </Link>
                </Button>
            </PopoverContent>
        </Popover>
    );
}
