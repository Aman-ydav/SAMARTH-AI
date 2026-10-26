import { useTranslation } from "react-i18next";
import { SessionsPanel } from "@/features/auth/components/SessionsPanel";
import { SettingsLayout } from "@/features/auth/components/SettingsLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** `/settings/sessions`: the devices the account is logged in on, with revoke one, revoke others and log out everywhere. */
export default function SettingsSessionsPage() {
    const { t } = useTranslation(["auth", "common"]);

    useDocumentTitle(
        t("common:documentTitle", { page: t("settings.sessions.title") })
    );

    return (
        <SettingsLayout
            title={t("settings.sessions.title")}
            description={t("settings.sessions.subtitle")}
        >
            <SessionsPanel />
        </SettingsLayout>
    );
}
