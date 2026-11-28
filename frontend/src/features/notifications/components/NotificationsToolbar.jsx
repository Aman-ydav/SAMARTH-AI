import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarkAllReadButton } from "@/features/notifications/components/MarkAllReadButton";

/**
 * Filter and bulk action of the notifications page. "All" and "Unread" are a labelled group of toggle buttons
 * (`aria-pressed`), because they filter one list rather than switch between panels. The choice is written to the URL by the
 * parent through `setQuery`.
 */
export function NotificationsToolbar({ query, setQuery }) {
    const { t } = useTranslation("notifications");
    const unreadOnly = query.unread === "true";

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div
                role="group"
                aria-label={t("page.filterLabel")}
                className="flex items-center gap-2"
            >
                <Button
                    type="button"
                    size="sm"
                    variant={unreadOnly ? "outline" : "secondary"}
                    aria-pressed={!unreadOnly}
                    onClick={() => setQuery({ unread: undefined })}
                >
                    {t("page.all")}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={unreadOnly ? "secondary" : "outline"}
                    aria-pressed={unreadOnly}
                    onClick={() => setQuery({ unread: "true" })}
                >
                    {t("page.unread")}
                </Button>
            </div>
            <MarkAllReadButton scope="page" />
        </div>
    );
}
