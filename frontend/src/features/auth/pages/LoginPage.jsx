import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { CheckCircleIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { ReactivatedPanel } from "@/features/auth/components/ReactivatedPanel";
import { selectJustReactivated } from "@/features/auth/slice/authSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

/* Notices other screens pass through router state; only these known names are ever rendered. */
const NOTICES = new Map([["passwordReset", "login.passwordResetNotice"]]);

export default function LoginPage() {
    const { t } = useTranslation(["auth", "common"]);
    const location = useLocation();
    const reactivated = useAppSelector(selectJustReactivated);
    const carried = readReturnTo(location, null);
    const noticeKey = NOTICES.get(location.state?.notice);

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(reactivated ? "login.reactivated.title" : "login.title"),
        })
    );

    if (reactivated) return <ReactivatedPanel />;

    return (
        <AuthCard
            title={t("login.title")}
            description={t("login.subtitle")}
            footer={
                <p>
                    {t("noAccount")}{" "}
                    <Link
                        to={PATHS.signup}
                        state={carried ? { returnTo: carried } : undefined}
                        className="font-medium text-primary-text underline underline-offset-4"
                    >
                        {t("createAccount")}
                    </Link>
                </p>
            }
        >
            {noticeKey && (
                <Alert variant="success">
                    <CheckCircleIcon aria-hidden="true" />
                    <AlertDescription>{t(noticeKey)}</AlertDescription>
                </Alert>
            )}
            <LoginForm />
        </AuthCard>
    );
}
