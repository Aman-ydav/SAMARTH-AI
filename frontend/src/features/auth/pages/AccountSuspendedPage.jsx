import { useTranslation } from "react-i18next";
import { UserForbidIcon } from "@/components/icons";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLogoutAction } from "@/features/auth/hooks/useLogoutAction";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/** Where "contact support" points until the team publishes a real support address (docs/23 section 8, item 1). */
const SUPPORT_PATH = `${PATHS.terms}#changes`;

/**
 * `/account-suspended`: shown after a correct password on a suspended account (`ACCOUNT_SUSPENDED`, AUTH-35).
 * A signed-in visitor can log out; an anonymous one just goes back to the log in page.
 */
export default function AccountSuspendedPage() {
    const { t } = useTranslation(["errors", "auth", "common"]);
    const { isAuthenticated } = useAuth();
    const session = useLogoutAction();

    useDocumentTitle(
        t("common:documentTitle", { page: t("accountSuspended.title") })
    );

    return (
        <StatePanel
            icon={UserForbidIcon}
            tone="destructive"
            title={t("accountSuspended.title")}
            body={t("accountSuspended.body")}
            primary={{
                label: t("accountSuspended.primary"),
                to: SUPPORT_PATH,
            }}
            secondary={
                isAuthenticated
                    ? {
                          label: t("accountSuspended.secondary"),
                          onClick: session.logout,
                          disabled: session.pending,
                      }
                    : { label: t("auth:backToLogin"), to: PATHS.login }
            }
        >
            <FormFailureAlert
                failure={session.failure}
                cooldownSec={session.cooldownSec}
            />
        </StatePanel>
    );
}
