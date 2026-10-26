import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { TimerIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

/**
 * `/session-expired` (FE-58): explains that the session ended and offers a fresh sign-in. The safe return path
 * the guard or listener attached (path only, AUTH-57) is passed on to /login so the person lands where they were.
 */
export default function SessionExpiredPage() {
    const { t } = useTranslation(["errors", "common"]);
    const location = useLocation();
    const carried = readReturnTo(location, null);

    useDocumentTitle(
        t("common:documentTitle", { page: t("sessionExpired.title") })
    );

    return (
        <StatePanel
            icon={TimerIcon}
            tone="warning"
            title={t("sessionExpired.title")}
            body={t("sessionExpired.body")}
            primary={{
                label: t("sessionExpired.primary"),
                to: PATHS.login,
                state: carried ? { returnTo: carried } : undefined,
            }}
            secondary={{
                label: t("sessionExpired.secondary"),
                to: PATHS.home,
            }}
        />
    );
}
