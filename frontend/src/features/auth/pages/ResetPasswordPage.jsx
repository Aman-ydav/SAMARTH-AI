import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { KeyIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { LINK_ERROR_CODES } from "@/features/auth/hooks/useAuthFormSubmit";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { validateResetToken } from "@/features/auth/slice/accountSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/**
 * `/reset-password#token=...` (AUTH-50..54). The token is read from the fragment once, stripped from the address
 * bar and kept in state. A non-consuming check decides between the form and the single generic "link invalid"
 * screen; only the form's POST consumes the token. Success goes to /login with a notice, never auto-login.
 */
export default function ResetPasswordPage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { token, hasToken } = useFragmentToken();
    const [phase, setPhase] = useState(hasToken ? "checking" : "invalid");
    const { run, pending, failure, cooldownSec } = useAsyncAction();
    const started = useRef(false);

    const validate = useCallback(
        () =>
            run(
                async () => {
                    await dispatch(validateResetToken({ token })).unwrap();
                    setPhase("form");
                },
                (error) => {
                    const gone =
                        error.code === LINK_ERROR_CODES.RESET_TOKEN_INVALID;
                    setPhase(gone ? "invalid" : "retry");
                    return gone;
                }
            ),
        [dispatch, run, token]
    );

    useEffect(() => {
        if (!token || started.current) return;
        started.current = true;
        validate();
    }, [token, validate]);

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(phase === "invalid" ? "resetInvalid.title" : "reset.title"),
        })
    );

    function done() {
        navigate(PATHS.login, {
            replace: true,
            state: { notice: "passwordReset" },
        });
    }

    if (phase === "invalid")
        return (
            <StatePanel
                focusTitle
                icon={KeyIcon}
                tone="warning"
                title={t("resetInvalid.title")}
                body={t("resetInvalid.body")}
                primary={{
                    label: t("resetInvalid.primary"),
                    to: PATHS.forgotPassword,
                }}
                secondary={{
                    label: t("resetInvalid.secondary"),
                    to: PATHS.login,
                }}
            />
        );

    if (phase === "form")
        return (
            <AuthCard
                title={t("reset.title")}
                description={t("reset.subtitle")}
            >
                <ResetPasswordForm
                    token={token}
                    onDone={done}
                    onInvalid={() => setPhase("invalid")}
                />
            </AuthCard>
        );

    return (
        <AuthCard title={t("reset.title")} description={t("reset.subtitle")}>
            {phase === "checking" && (
                <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <Spinner />
                    {t("reset.checking")}
                </p>
            )}
            {phase === "retry" && (
                <div className="flex flex-col gap-4">
                    <FormFailureAlert
                        failure={failure}
                        cooldownSec={cooldownSec}
                    />
                    <Button
                        type="button"
                        onClick={() => {
                            setPhase("checking");
                            validate();
                        }}
                        disabled={pending || cooldownSec > 0}
                    >
                        {t("common:retry")}
                    </Button>
                </div>
            )}
        </AuthCard>
    );
}
