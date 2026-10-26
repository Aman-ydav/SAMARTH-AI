import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { LazyStatusIcon } from "@/app/providers/LazyStatusIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { selectOffline, selectServerWaking } from "@/features/preferences";

/** Persistent offline and "server is waking up" banners driven by the ui slice (FE-42, FE-48, FE-107). */
export function StatusBanners() {
    const { t } = useTranslation("common");
    const offline = useAppSelector(selectOffline);
    const waking = useAppSelector(selectServerWaking);

    if (!offline && !waking) return null;
    return (
        <div className="sticky top-0 z-40 flex flex-col gap-2 p-2">
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
