import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { PasswordStrengthHint } from "@/features/auth/components/PasswordStrengthHint";
import { SubmitButton } from "@/components/common/SubmitButton";
import {
    LINK_ERROR_CODES,
    useAuthFormSubmit,
} from "@/features/auth/hooks/useAuthFormSubmit";
import { resetPasswordSchema } from "@/features/auth/schemas/authSchemas";
import { resetPassword } from "@/features/auth/slice/accountSlice";

const FIELDS = ["newPassword", "confirmPassword"];
const CODE_FIELDS = Object.freeze({
    PASSWORD_POLICY: "newPassword",
    PASSWORD_REUSED: "newPassword",
});

/**
 * New-password form behind a reset link (AUTH-50..54). The one-time `token` arrives as a prop from the page's
 * state and goes only into the POST body. A used, expired or unknown token (`RESET_TOKEN_INVALID`) calls
 * `onInvalid`; success calls `onDone`, and nobody is signed in automatically.
 */
export function ResetPasswordForm({ token, onDone, onInvalid }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const form = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { newPassword: "", confirmPassword: "" },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const newPassword = useWatch({
        control: form.control,
        name: "newPassword",
    });

    const onSubmit = form.handleSubmit((values) =>
        submit.run(
            async () => {
                await dispatch(
                    resetPassword({ token, newPassword: values.newPassword })
                ).unwrap();
                onDone();
            },
            (error) => {
                if (error.code !== LINK_ERROR_CODES.RESET_TOKEN_INVALID)
                    return false;
                onInvalid();
                return true;
            }
        )
    );

    return (
        <form
            noValidate
            onSubmit={onSubmit}
            aria-busy={submit.pending}
            className="flex flex-col gap-6"
        >
            <FieldSet disabled={submit.pending}>
                <AuthField
                    form={form}
                    name="newPassword"
                    password
                    label={t("newPassword")}
                    autoComplete="new-password"
                >
                    <PasswordStrengthHint password={newPassword} />
                </AuthField>
                <AuthField
                    form={form}
                    name="confirmPassword"
                    password
                    label={t("confirmPassword")}
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
                {t("reset.submit")}
            </SubmitButton>
        </form>
    );
}
