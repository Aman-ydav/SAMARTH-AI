import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for the notification lists, announced once as a status instead of once per bar (FE-93). */
export function NotificationsSkeleton({ rows = 5 }) {
    const { t } = useTranslation("common");
    return (
        <div
            role="status"
            aria-label={t("loading")}
            className="flex flex-col gap-2"
        >
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
            ))}
        </div>
    );
}
