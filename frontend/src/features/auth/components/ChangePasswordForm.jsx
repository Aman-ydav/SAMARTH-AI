import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { InfoIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { ErrorSummary } from "@/features/auth/components/ErrorSummary";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { PasswordStrengthHint } from "@/features/auth/components/PasswordStrengthHint";
import { SubmitButton } from "@/components/common/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { changePasswordSchema } from "@/features/auth/schemas/authSchemas";
import { changePassword } from "@/features/auth/slice/accountSlice";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"];
const CODE_FIELDS = Object.freeze({
    INVALID_CREDENTIALS: "currentPassword",
    PASSWORD_POLICY: "newPassword",
    PASSWORD_REUSED: "newPassword",
});

/**
 * Change-password form with re-authentication (AUTH-55): the current password is always required. It also serves
 * the forced change after an admin-set password (`mustChangePassword`). Changing the password signs the other
 * devices out, and the form says so up front.
 */
export function ChangePasswordForm({ onChanged, submitLabel }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const [summarySignal, setSummarySignal] = useState(0);
    const form = useForm({
        resolver: zodResolver(changePasswordSchema),
        shouldFocusError: false,
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const newPassword = useWatch({
        control: form.control,
        name: "newPassword",
    });
    const labels = {
        currentPassword: t("currentPassword"),
        newPassword: t("newPassword"),
        confirmPassword: t("confirmPassword"),
    };

    const onSubmit = form.handleSubmit(
        (values) =>
            submit.run(async () => {
                await dispatch(
                    changePassword({
                        currentPassword: values.currentPassword,
                        newPassword: values.newPassword,
                    })
                ).unwrap();
                onChanged();
            }),
        () => setSummarySignal((count) => count + 1)
    );

    return (
        <form
            noValidate
            onSubmit={onSubmit}
            aria-busy={submit.pending}
            className="flex flex-col gap-6"
        >
            <Alert variant="info" role="note">
                <InfoIcon aria-hidden="true" />
                <AlertDescription>{t("mustChange.notice")}</AlertDescription>
            </Alert>
            <ErrorSummary
                errors={form.formState.errors}
                labels={labels}
                onSelect={form.setFocus}
                focusSignal={summarySignal}
            />
            <FieldSet disabled={submit.pending}>
                <AuthField
                    form={form}
                    name="currentPassword"
                    password
                    label={labels.currentPassword}
                    autoComplete="current-password"
                />
                <AuthField
                    form={form}
                    name="newPassword"
                    password
                    label={labels.newPassword}
                    autoComplete="new-password"
                >
                    <PasswordStrengthHint password={newPassword} />
                </AuthField>
                <AuthField
                    form={form}
                    name="confirmPassword"
                    password
                    label={labels.confirmPassword}
                    autoComplete="new-password"
                />
            </FieldSet>
            <FormFailureAlert
                failure={submit.failure}
                cooldownSec={submit.cooldownSec}
            />
            <SubmitButton
                pending={submit.pending}
                disabled={submit.cooldownSec > 0}
            >
                {submitLabel ?? t("mustChange.primary")}
            </SubmitButton>
        </form>
    );
}
