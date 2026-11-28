import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { MailSendIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ResendCountdown } from "@/features/auth/components/ResendCountdown";
import {
    pendingEmailSet,
    selectPendingEmail,
} from "@/features/auth/slice/authSlice";
import { resendVerification } from "@/features/auth/slice/registrationSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

const COOLDOWN_SEC = 60;

/**
 * "Check your inbox" after sign-up (doc 23 section 6.2). Without a pending email in state there is nothing to
 * show, so the visitor goes back to sign-up. Resend waits 60 s; "change email" returns to sign-up (a mistyped
 * address is replaced by registering again, the old pending account is purged after 7 days).
 */
export default function VerifyEmailSentPage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const email = useAppSelector(selectPendingEmail);
    const location = useLocation();
    const verificationRequired =
        location.state?.verificationRequired !== false;

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(
                verificationRequired
                    ? "verifySent.title"
                    : "signup.readyTitle"
            ),
        })
    );

    if (!email) return <Navigate to={PATHS.signup} replace />;

    return (
        <AuthCard
            icon={MailSendIcon}
            title={t(
                verificationRequired
                    ? "verifySent.title"
                    : "signup.readyTitle"
            )}
            description={t(
                verificationRequired
                    ? "verifySent.body"
                    : "signup.readyBody",
                { email }
            )}
        >
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    {t(
                        verificationRequired
                            ? "verifySent.hint"
                            : "signup.readyHint"
                    )}
                </p>
                {verificationRequired ? (
                    <ResendCountdown
                        label={t("verifySent.primary")}
                        initialSec={COOLDOWN_SEC}
                        onResend={() =>
                            dispatch(resendVerification({ email })).unwrap()
                        }
                    />
                ) : (
                    <Button asChild>
                        <Link to={PATHS.login}>{t("signup.signInNow")}</Link>
                    </Button>
                )}
                {verificationRequired && (
                    <p className="text-sm text-muted-foreground">
                        {t("verifySent.changeHint")}
                    </p>
                )}
                <Button asChild variant="outline">
                    <Link
                        to={PATHS.signup}
                        onClick={() => dispatch(pendingEmailSet(null))}
                    >
                        {t("verifySent.secondary")}
                    </Link>
                </Button>
            </div>
        </AuthCard>
    );
}
