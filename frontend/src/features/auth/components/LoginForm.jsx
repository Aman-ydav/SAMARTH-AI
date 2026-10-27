import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { CookieIcon, TimerIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldSet } from "@/components/ui/field";
import { AuthCheckboxField } from "@/features/auth/components/AuthCheckboxField";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { SubmitButton } from "@/components/common/SubmitButton";
import { UnverifiedNotice } from "@/features/auth/components/UnverifiedNotice";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { useSignInFlow } from "@/features/auth/hooks/useSignInFlow";
import { loginSchema, toLoginBody } from "@/features/auth/schemas/authSchemas";
import {
    lockoutCleared,
    loginUser,
    selectLockout,
} from "@/features/auth/slice/authSlice";
import { useCountdown } from "@/hooks/useCountdown";
import { API_ERROR_CODES } from "@/lib/apiError";
import { formatCountdown } from "@/lib/format";
import { PATHS } from "@/lib/paths";

const FIELDS = ["email", "password"];

/**
 * Email and password sign-in (doc 20 section 4). Wrong email, wrong password, Google-only and unknown accounts all
 * show the same generic message plus the "Google or reset" hint (AUTH-34). `reactivate` turns the same form into
 * the password re-entry of the account-deactivated screen, which re-submits the login with `reactivate: true`.
 */
export function LoginForm({ reactivate = false, defaultEmail = "" }) {
    const { t } = useTranslation(["auth", "errors"]);
    const dispatch = useAppDispatch();
    const flow = useSignInFlow({ reactivating: reactivate });
    const lockout = useAppSelector(selectLockout);
    const lock = useCountdown(lockout?.until ?? null);
    const [unverified, setUnverified] = useState(null);
    const form = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: defaultEmail, password: "", rememberMe: false },
    });
    const submit = useAuthFormSubmit(form, FIELDS);
    const cookiesOff =
        typeof navigator !== "undefined" && navigator.cookieEnabled === false;
    const locked = lock.isRunning;

    useEffect(() => {
        if (lockout && !lock.isRunning) dispatch(lockoutCleared());
    }, [dispatch, lockout, lock.isRunning]);

    function handleError(error, email) {
        if (error.code === API_ERROR_CODES.EMAIL_NOT_VERIFIED) {
            setUnverified({ email, retryAfterSec: error.retryAfterSec ?? 0 });
            return true;
        }
        if (error.code === API_ERROR_CODES.INVALID_CREDENTIALS) {
            form.resetField("password");
            submit.focusFieldLater("password");
            return false;
        }
        return flow.onFailure(error, { email });
    }

    const onSubmit = form.handleSubmit((values) =>
        submit.run(
            async () => {
                setUnverified(null);
                const body = toLoginBody({ ...values, reactivate });
                const session = await dispatch(loginUser(body)).unwrap();
                flow.onSuccess(session);
            },
            (error) => handleError(error, values.email)
        )
    );

    return (
        <div className="flex flex-col gap-6">
            <form
                noValidate
                onSubmit={onSubmit}
                aria-busy={submit.pending}
                className="flex flex-col gap-6"
            >
                {cookiesOff && (
                    <Alert variant="warning">
                        <CookieIcon aria-hidden="true" />
                        <AlertDescription className="flex flex-col gap-1">
                            <p>{t("cookiesDisabled")}</p>
                            <Link
                                to={PATHS.cookiesDisabled}
                                className="underline underline-offset-4"
                            >
                                {t("cookiesHelp")}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}
                {locked && (
                    <Alert variant="warning" role="status" aria-live="off">
                        <TimerIcon aria-hidden="true" />
                        <AlertDescription className="flex flex-col gap-1">
                            <p>
                                {t("login.locked", {
                                    time: formatCountdown(lock.remainingSec),
                                })}
                            </p>
                            <Link
                                to={PATHS.forgotPassword}
                                className="underline underline-offset-4"
                            >
                                {t("login.lockedAction")}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}
                <FieldSet disabled={submit.pending}>
                    <AuthField
                        form={form}
                        name="email"
                        type="email"
                        label={t("email")}
                        autoComplete="username"
                        placeholder={t("placeholder.email")}
                    />
                    <AuthField
                        form={form}
                        name="password"
                        password
                        label={t("password")}
                        autoComplete="current-password"
                        labelAside={
                            <Link
                                to={PATHS.forgotPassword}
                                className="text-sm text-primary-text underline-offset-4 hover:underline"
                            >
                                {t("forgotLink")}
                            </Link>
                        }
                    />
                    {!reactivate && (
                        <AuthCheckboxField
                            form={form}
                            name="rememberMe"
                            label={t("remember")}
                        />
                    )}
                </FieldSet>
                {unverified && <UnverifiedNotice {...unverified} />}
                <FormFailureAlert
                    failure={submit.failure}
                    cooldownSec={submit.cooldownSec}
                />
                <SubmitButton
                    pending={submit.pending}
                    disabled={cookiesOff || locked || submit.cooldownSec > 0}
                >
                    {reactivate
                        ? t("errors:accountDeactivated.primary")
                        : t("signIn")}
                </SubmitButton>
            </form>
            {!reactivate && (
                <GoogleButton
                    onSession={flow.onSuccess}
                    onFailure={flow.onFailure}
                />
            )}
        </div>
    );
}
