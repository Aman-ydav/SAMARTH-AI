import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { CheckCircleIcon, LockIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { selectLockout } from "@/features/auth/slice/authSlice";
import { useCountdown } from "@/hooks/useCountdown";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatCountdown } from "@/lib/format";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

/**
 * `/account-locked` (AUTH-36): live countdown from the absolute deadline the login failure stored. The lock looks
 * identical for real and unknown accounts, so the page says nothing about whether an account exists. When the
 * time is up it offers the way back to log in; without a stored lock it shows the generic wait advice.
 */
export default function AccountLockedPage() {
    const { t } = useTranslation(["errors", "auth", "common"]);
    const location = useLocation();
    const lockout = useAppSelector(selectLockout);
    const { remainingSec, isRunning } = useCountdown(lockout?.until ?? null);
    const carried = readReturnTo(location, null);
    const loginTarget = {
        to: PATHS.login,
        state: carried ? { returnTo: carried } : undefined,
    };
    const unlocked = Boolean(lockout) && !isRunning;

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(
                unlocked
                    ? "auth:locked.unlockedTitle"
                    : "errors:accountLocked.title"
            ),
        })
    );

    if (unlocked)
        return (
            <StatePanel
                focusTitle
                icon={CheckCircleIcon}
                tone="success"
                title={t("auth:locked.unlockedTitle")}
                body={t("auth:locked.unlockedBody")}
                primary={{
                    label: t("auth:locked.unlockedAction"),
                    ...loginTarget,
                }}
            />
        );

    return (
        <StatePanel
            icon={LockIcon}
            tone="warning"
            title={t("errors:accountLocked.title")}
            body={
                isRunning
                    ? t("errors:accountLocked.body", {
                          time: formatCountdown(remainingSec),
                      })
                    : t("auth:locked.unknown")
            }
            primary={{
                label: t("errors:accountLocked.primary"),
                to: PATHS.forgotPassword,
            }}
            secondary={{
                label: t("errors:accountLocked.secondary"),
                ...loginTarget,
            }}
        />
    );
}
