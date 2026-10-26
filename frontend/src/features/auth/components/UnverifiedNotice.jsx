import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { MailSendIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResendCountdown } from "@/features/auth/components/ResendCountdown";
import { resendVerification } from "@/features/auth/slice/registrationSlice";
import { PATHS } from "@/lib/paths";

/**
 * Shown after a correct password on an account whose email is not verified yet (`EMAIL_NOT_VERIFIED`, AUTH-35).
 * Offers the resend flow with a cooldown that starts from the server's `retryAfterSec` when it sends one.
 */
export function UnverifiedNotice({ email, retryAfterSec = 0 }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();

    return (
        <Alert variant="warning">
            <MailSendIcon aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-3">
                <p>{t("login.unverified")}</p>
                <ResendCountdown
                    initialSec={retryAfterSec}
                    onResend={() =>
                        dispatch(resendVerification({ email })).unwrap()
                    }
                />
                <Link
                    to={PATHS.verifyEmailSent}
                    className="underline underline-offset-4"
                >
                    {t("verifySent.title")}
                </Link>
            </AlertDescription>
        </Alert>
    );
}
