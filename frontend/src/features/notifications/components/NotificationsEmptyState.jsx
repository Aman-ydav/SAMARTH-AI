import { useTranslation } from "react-i18next";
import { BellIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Empty list (UI-50): muted icon, title, one sentence and, when a filter hides older items, one action to clear it.
 * `filtered` means the unread filter is on, so "nothing here" does not mean "nothing ever".
 */
export function NotificationsEmptyState({ filtered, onShowAll }) {
    const { t } = useTranslation("notifications");
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-12 text-center">
            <BellIcon
                className="size-6 text-muted-foreground"
                aria-hidden="true"
            />
            <p className="font-medium text-foreground">
                {t(filtered ? "empty.unreadTitle" : "empty.allTitle")}
            </p>
            <p className="max-w-prose text-muted-foreground">
                {t(filtered ? "empty.unreadBody" : "empty.allBody")}
            </p>
            {filtered && (
                <Button type="button" variant="outline" onClick={onShowAll}>
                    {t("empty.showAll")}
                </Button>
            )}
        </div>
    );
}
