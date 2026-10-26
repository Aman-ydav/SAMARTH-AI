import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { ForgotSentPanel } from "@/features/auth/components/ForgotSentPanel";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

export default function ForgotPasswordPage() {
    const { t } = useTranslation(["auth", "common"]);
    const [sentTo, setSentTo] = useState(null);

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(sentTo ? "forgotSent.title" : "forgot.title"),
        })
    );

    if (sentTo) return <ForgotSentPanel email={sentTo} />;

    return (
        <AuthCard
            title={t("forgot.title")}
            description={t("forgot.subtitle")}
            footer={
                <Link
                    to={PATHS.login}
                    className="font-medium text-primary-text underline underline-offset-4"
                >
                    {t("backToLogin")}
                </Link>
            }
        >
            <ForgotPasswordForm onSent={setSentTo} />
        </AuthCard>
    );
}
