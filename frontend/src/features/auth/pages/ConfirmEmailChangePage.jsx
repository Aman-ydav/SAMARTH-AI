import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { HistoryIcon, MailIcon, VerifiedIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { TokenConfirmPanel } from "@/features/auth/components/TokenConfirmPanel";
import { useAsyncAction } from "@/features/auth/hooks/useAsyncAction";
import { LINK_ERROR_CODES } from "@/features/auth/hooks/useAuthFormSubmit";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { confirmEmailChange } from "@/features/auth/slice/accountSlice";
import { fetchCurrentUser } from "@/features/auth/slice/authSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/**
 * `/confirm-email-change#token=...` (R2, R38, AUTH-55): the link sent to the NEW address. Opening it only shows a confirm
 * button, because mail scanners prefetch links; the POST that applies the change happens on the click. The token is read
 * once from the fragment, stripped from the address bar and sent in the body. An expired or used link shows one generic
 * message. A signed-in visitor gets the new address in the app straight away (`/auth/me` is read again).
 */
export default function ConfirmEmailChangePage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const { token, hasToken } = useFragmentToken();
    const { isAuthenticated } = useAuth();
    const [invalid, setInvalid] = useState(!hasToken);
    const [done, setDone] = useState(false);
    const { run, pending, failure, cooldownSec } = useAsyncAction();

    let titleKey = "confirmEmailChange.title";
    if (done) titleKey = "confirmEmailChange.done.title";
    else if (invalid) titleKey = "confirmEmailChange.invalid.title";
    useDocumentTitle(t("common:documentTitle", { page: t(titleKey) }));

    function confirm() {
        run(
            async () => {
                await dispatch(confirmEmailChange({ token })).unwrap();
                setDone(true);
                if (isAuthenticated)
                    dispatch(fetchCurrentUser({ force: true }));
            },
            (error) => {
                if (error.code !== LINK_ERROR_CODES.EMAIL_CHANGE_INVALID)
                    return false;
                setInvalid(true);
                return true;
            }
        );
    }

    if (done)
        return (
            <StatePanel
                focusTitle
                icon={VerifiedIcon}
                tone="success"
                title={t("confirmEmailChange.done.title")}
                body={t("confirmEmailChange.done.body")}
                primary={
                    isAuthenticated
                        ? {
                              label: t(
                                  "confirmEmailChange.done.actionSignedIn"
                              ),
                              to: PATHS.settingsSecurity,
                          }
                        : {
                              label: t("confirmEmailChange.done.action"),
                              to: PATHS.login,
                          }
                }
            />
        );

    if (invalid)
        return (
            <StatePanel
                focusTitle
                icon={HistoryIcon}
                tone="warning"
                title={t("confirmEmailChange.invalid.title")}
                body={t("confirmEmailChange.invalid.body")}
                primary={{
                    label: t("confirmEmailChange.invalid.primary"),
                    to: PATHS.settingsSecurity,
                }}
                secondary={{
                    label: t("confirmEmailChange.invalid.secondary"),
                    to: PATHS.login,
                }}
            />
        );

    return (
        <TokenConfirmPanel
            icon={MailIcon}
            title={t("confirmEmailChange.title")}
            body={t("confirmEmailChange.subtitle")}
            confirmLabel={t("confirmEmailChange.confirm")}
            onConfirm={confirm}
            pending={pending}
            failure={failure}
            cooldownSec={cooldownSec}
        />
    );
}
