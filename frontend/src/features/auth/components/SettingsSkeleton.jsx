import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for a settings section; announced once as a status instead of per bar. */
export function SettingsSkeleton({ rows = 3 }) {
    const { t } = useTranslation("auth");
    return (
        <div
            role="status"
            aria-label={t("settings.loadingLabel")}
            className="flex flex-col gap-4"
        >
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
            ))}
        </div>
    );
}
