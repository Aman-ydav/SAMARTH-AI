import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { HistoryIcon, MailLockIcon, VerifiedIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { TokenConfirmPanel } from "@/features/auth/components/TokenConfirmPanel";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { LINK_ERROR_CODES } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { undoEmailChange } from "@/features/auth/slice/accountSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/**
 * `/undo-email-change#token=...` (R8, R38): the 24-hour link sent to the OLD address. Like every email link it only shows
 * a confirm button; the POST that restores the previous address runs on the click. The server then logs every device out,
 * so the success screen says so and sends the person to log in (the `auth` listeners drop this tab's session).
 */
export default function UndoEmailChangePage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const { token, hasToken } = useFragmentToken();
    const [invalid, setInvalid] = useState(!hasToken);
    const [done, setDone] = useState(false);
    const { run, pending, failure, cooldownSec } = useAsyncAction();

    let titleKey = "undoEmailChange.title";
    if (done) titleKey = "undoEmailChange.done.title";
    else if (invalid) titleKey = "undoEmailChange.invalid.title";
    useDocumentTitle(t("common:documentTitle", { page: t(titleKey) }));

    function confirm() {
        run(
            async () => {
                await dispatch(undoEmailChange({ token })).unwrap();
                setDone(true);
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
                title={t("undoEmailChange.done.title")}
                body={t("undoEmailChange.done.body")}
                primary={{
                    label: t("undoEmailChange.done.action"),
                    to: PATHS.login,
                }}
            />
        );

    if (invalid)
        return (
            <StatePanel
                focusTitle
                icon={HistoryIcon}
                tone="warning"
                title={t("undoEmailChange.invalid.title")}
                body={t("undoEmailChange.invalid.body")}
                primary={{
                    label: t("undoEmailChange.invalid.primary"),
                    to: PATHS.login,
                }}
                secondary={{
                    label: t("undoEmailChange.invalid.secondary"),
                    to: PATHS.forgotPassword,
                }}
            />
        );

    return (
        <TokenConfirmPanel
            icon={MailLockIcon}
            title={t("undoEmailChange.title")}
            body={t("undoEmailChange.subtitle")}
            confirmLabel={t("undoEmailChange.confirm")}
            onConfirm={confirm}
            pending={pending}
            failure={failure}
            cooldownSec={cooldownSec}
        />
    );
}
