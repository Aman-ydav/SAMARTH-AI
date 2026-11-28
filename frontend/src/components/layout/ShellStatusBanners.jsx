import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { HourglassIcon, WifiOffIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { selectOffline, selectServerWaking } from "@/features/preferences";

/**
 * The offline and "server is waking up" banners of the signed-in shell (FE-42, FE-48, FE-107). They sit in the content column
 * directly under the top bar: `top-14` is the top bar's height and `z-30` its level, so they stay visible while the page
 * scrolls and can never cover the top bar or the sidebar (UI-43). Public and auth pages use the plain `StatusBanners` of the
 * root layout instead. The shell is a lazy chunk, so it may use the icon registry directly (UI-31).
 */
export function ShellStatusBanners() {
    const { t } = useTranslation("common");
    const offline = useAppSelector(selectOffline);
    const waking = useAppSelector(selectServerWaking);

    if (!offline && !waking) return null;
    return (
        <div className="sticky top-14 z-30 flex flex-col gap-2 bg-background p-2">
            {offline ? (
                <Alert variant="warning" role="status">
                    <WifiOffIcon aria-hidden="true" />
                    <AlertDescription>{t("banner.offline")}</AlertDescription>
                </Alert>
            ) : null}
            {waking ? (
                <Alert variant="info" role="status">
                    <HourglassIcon aria-hidden="true" />
                    <AlertDescription>{t("banner.waking")}</AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}
