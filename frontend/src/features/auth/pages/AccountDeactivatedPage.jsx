import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { UserUnfollowIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

const MAX_EMAIL = 254;

/**
 * `/account-deactivated` (R18, doc 20 section 4): after a correct password on a deactivated account the login
 * answers `ACCOUNT_DEACTIVATED`. This page asks for the password again and re-submits the login with
 * `reactivate: true`. The email may arrive in router state from the login form; it is never put in the URL.
 */
export default function AccountDeactivatedPage() {
    const { t } = useTranslation(["errors", "auth", "common"]);
    const location = useLocation();
    const stateEmail = location.state?.email;
    const defaultEmail =
        typeof stateEmail === "string" && stateEmail.length <= MAX_EMAIL
            ? stateEmail
            : "";
    const carried = readReturnTo(location, null);

    useDocumentTitle(
        t("common:documentTitle", { page: t("accountDeactivated.title") })
    );

    return (
        <AuthCard
            icon={UserUnfollowIcon}
            tone="warning"
            title={t("accountDeactivated.title")}
            description={t("accountDeactivated.body")}
            footer={
                <>
                    <p>{t("auth:deactivated.googleNote")}</p>
                    <Button asChild variant="link" className="px-0">
                        <Link
                            to={PATHS.login}
                            state={carried ? { returnTo: carried } : undefined}
                        >
                            {t("auth:backToLogin")}
                        </Link>
                    </Button>
                </>
            }
        >
            <p className="text-sm text-muted-foreground">
                {t("auth:deactivated.intro")}
            </p>
            <LoginForm reactivate defaultEmail={defaultEmail} />
        </AuthCard>
    );
}
