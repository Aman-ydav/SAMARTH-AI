import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { LazyStatusIcon } from "@/app/providers/LazyStatusIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { selectOffline, selectServerWaking } from "@/features/preferences";

/**
 * Persistent offline and "server is waking up" banners driven by the ui slice (FE-42, FE-48, FE-107) for public and auth
 * pages. They stay in the normal flow instead of being pinned to the top of the page, where they used to sit on top of the
 * sticky navbar. The signed-in shell shows its own copy under its top bar (`ShellStatusBanners`) and the root layout skips
 * this one there.
 */
export function StatusBanners() {
    const { t } = useTranslation("common");
    const offline = useAppSelector(selectOffline);
    const waking = useAppSelector(selectServerWaking);

    if (!offline && !waking) return null;
    return (
        <div className="flex flex-col gap-2 p-2">
            {offline ? (
                <Alert variant="warning" role="status">
                    <LazyStatusIcon name="wifiOff" />
                    <AlertDescription>{t("banner.offline")}</AlertDescription>
                </Alert>
            ) : null}
            {waking ? (
                <Alert variant="info" role="status">
                    <LazyStatusIcon name="hourglass" />
                    <AlertDescription>{t("banner.waking")}</AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}
