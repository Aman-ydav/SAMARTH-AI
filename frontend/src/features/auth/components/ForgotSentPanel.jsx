import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { MailLockIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ResendCountdown } from "@/features/auth/components/ResendCountdown";
import { forgotPassword } from "@/features/auth/slice/accountSlice";
import { PATHS } from "@/lib/paths";

const COOLDOWN_SEC = 60;

/**
 * The neutral "reset link sent" screen (AUTH-46): the same text for every address, whether or not an account
 * exists. Resending waits for a cooldown and shows the same neutral result.
 */
export function ForgotSentPanel({ email }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();

    return (
        <AuthCard
            focusTitle
            icon={MailLockIcon}
            title={t("forgotSent.title")}
            description={t("forgotSent.body")}
        >
            <div className="flex flex-col gap-4">
                <ResendCountdown
                    label={t("forgotSent.secondary")}
                    initialSec={COOLDOWN_SEC}
                    sentMessage={t("forgotSent.body")}
                    onResend={() =>
                        dispatch(forgotPassword({ email })).unwrap()
                    }
                />
                <Button asChild>
                    <Link to={PATHS.login}>{t("forgotSent.primary")}</Link>
                </Button>
            </div>
        </AuthCard>
    );
}
