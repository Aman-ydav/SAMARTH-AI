import { useTranslation } from "react-i18next";
import { ToolsIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/**
 * `/sso/callback` is a prototype stub (doc 20 section 1: SSO is "mock then real"). It deliberately reads nothing
 * from the URL (no `code`, no `state`), signs nobody in and sends nothing anywhere; it only explains that and
 * points back to the working sign-in methods.
 */
export default function SsoCallbackPage() {
    const { t } = useTranslation(["auth", "common", "errors"]);

    useDocumentTitle(t("common:documentTitle", { page: t("sso.title") }));

    return (
        <StatePanel
            icon={ToolsIcon}
            tone="info"
            title={t("sso.stubTitle")}
            body={t("sso.stubBody")}
            primary={{ label: t("backToLogin"), to: PATHS.login }}
            secondary={{ label: t("common:goHome"), to: PATHS.home }}
        >
            <p className="text-sm text-muted-foreground">{t("sso.stubNote")}</p>
        </StatePanel>
    );
}
