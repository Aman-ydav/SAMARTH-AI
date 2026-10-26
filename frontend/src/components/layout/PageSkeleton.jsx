import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown inside the app shell while a lazy page or its translations load, so the shell never blinks away. */
export function PageSkeleton() {
    const { t } = useTranslation("nav");
    return (
        <div
            role="status"
            aria-label={t("shell.pageLoading")}
            className="flex flex-col gap-6"
        >
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-5 w-full max-w-prose" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        </div>
    );
}
