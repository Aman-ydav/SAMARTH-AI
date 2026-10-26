import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { CheckCircleIcon } from "@/components/icons";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { PasswordStrengthHint } from "@/features/auth/components/PasswordStrengthHint";
import { ReauthFields } from "@/features/auth/components/ReauthFields";
import { SectionCard } from "@/features/auth/components/SectionCard";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import {
    changePasswordSchema,
    resetPasswordSchema,
} from "@/features/auth/schemas/authSchemas";
import { changePassword } from "@/features/auth/slice/accountSlice";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"];
const CODE_FIELDS = Object.freeze({
    INVALID_CREDENTIALS: "currentPassword",
    PASSWORD_POLICY: "newPassword",
    PASSWORD_REUSED: "newPassword",
});
const PROOF_CODES = ["REAUTH_REQUIRED", "GOOGLE_TOKEN_INVALID"];

/**
 * Change the password (AUTH-55): the current password is required; a Google-only account sets its first password with a fresh
 * Google credential instead. Success logs the other devices out, and the form says so before and after.
 */
export function PasswordSection({ user }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const hasPassword = user.hasPassword !== false;
    const [credential, setCredential] = useState(null);
    const [done, setDone] = useState(null);
    const form = useForm({
        resolver: zodResolver(
            hasPassword ? changePasswordSchema : resetPasswordSchema
        ),
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
    const ready = hasPassword || credential !== null;

    const onSubmit = form.handleSubmit((values) =>
        submit.run(
            async () => {
                const proof = hasPassword
                    ? { currentPassword: values.currentPassword }
                    : { credential };
                await dispatch(
                    changePassword({
                        ...proof,
                        newPassword: values.newPassword,
                    })
                ).unwrap();
                form.reset();
                setCredential(null);
                setDone(hasPassword ? "changed" : "set");
            },
            (error) => {
                if (PROOF_CODES.includes(error.code)) setCredential(null);
                return false;
            }
        )
    );

    return (
        <SectionCard
            title={t(
                hasPassword
                    ? "settings.password.heading"
                    : "settings.password.headingSet"
            )}
            description={t(
                hasPassword
                    ? "settings.password.description"
                    : "settings.password.descriptionSet"
            )}
        >
            <form
                noValidate
                onSubmit={onSubmit}
                aria-busy={submit.pending}
                className="flex max-w-md flex-col gap-6"
            >
                <FieldSet disabled={submit.pending}>
                    <ReauthFields
                        form={form}
                        hasPassword={hasPassword}
                        credential={credential}
                        onCredential={setCredential}
                        onReset={() => setCredential(null)}
                    />
                    <AuthField
                        form={form}
                        name="newPassword"
                        password
                        label={t("newPassword")}
                        autoComplete="new-password"
                    >
                        <PasswordStrengthHint
                            password={newPassword}
                            email={user.email}
                            name={user.name}
                        />
                    </AuthField>
                    <AuthField
                        form={form}
                        name="confirmPassword"
                        password
                        label={t("confirmPassword")}
                        autoComplete="new-password"
                    />
                </FieldSet>
                {done && (
                    <p
                        role="status"
                        className="flex items-center gap-2 text-sm"
                    >
                        <CheckCircleIcon
                            aria-hidden="true"
                            className="size-4 text-success-subtle-foreground"
                        />
                        {t(`settings.password.${done}`)}
                    </p>
                )}
                <FormFailureAlert
                    failure={submit.failure}
                    cooldownSec={submit.cooldownSec}
                />
                <SubmitButton
                    pending={submit.pending}
                    disabled={!ready || submit.cooldownSec > 0}
                    className="sm:w-fit"
                >
                    {t(
                        hasPassword
                            ? "settings.password.submit"
                            : "settings.password.submitSet"
                    )}
                </SubmitButton>
            </form>
        </SectionCard>
    );
}
