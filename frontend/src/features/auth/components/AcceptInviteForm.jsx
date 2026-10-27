import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { ErrorSummary } from "@/features/auth/components/ErrorSummary";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { PasswordStrengthHint } from "@/features/auth/components/PasswordStrengthHint";
import { SubmitButton } from "@/components/common/SubmitButton";
import {
    LINK_ERROR_CODES,
    useAuthFormSubmit,
} from "@/features/auth/hooks/useAuthFormSubmit";
import { acceptInviteSchema } from "@/features/auth/schemas/authSchemas";
import { acceptInvite } from "@/features/auth/slice/registrationSlice";

const FIELDS = ["name", "password", "confirmPassword"];
const CODE_FIELDS = Object.freeze({ PASSWORD_POLICY: "password" });

/**
 * Sets the name and password for an invited account (doc 20 section 8). The invite `token` comes from the page's
 * state and goes only into the POST body. The role comes from the invitation, never from this form (AUTH-59).
 * `INVITE_INVALID` calls `onInvalid`; success calls `onAccepted` with the new session.
 */
export function AcceptInviteForm({ token, onAccepted, onInvalid }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const [summarySignal, setSummarySignal] = useState(0);
    const form = useForm({
        resolver: zodResolver(acceptInviteSchema),
        shouldFocusError: false,
        defaultValues: { name: "", password: "", confirmPassword: "" },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const [password, name] = useWatch({
        control: form.control,
        name: ["password", "name"],
    });
    const labels = {
        name: t("name"),
        password: t("password"),
        confirmPassword: t("confirmPassword"),
    };

    const onSubmit = form.handleSubmit(
        (values) =>
            submit.run(
                async () => {
                    const session = await dispatch(
                        acceptInvite({
                            token,
                            name: values.name,
                            password: values.password,
                        })
                    ).unwrap();
                    onAccepted(session);
                },
                (error) => {
                    if (error.code !== LINK_ERROR_CODES.INVITE_INVALID)
                        return false;
                    onInvalid();
                    return true;
                }
            ),
        () => setSummarySignal((count) => count + 1)
    );

    return (
        <form
            noValidate
            onSubmit={onSubmit}
            aria-busy={submit.pending}
            className="flex flex-col gap-6"
        >
            <ErrorSummary
                errors={form.formState.errors}
                labels={labels}
                onSelect={form.setFocus}
                focusSignal={summarySignal}
            />
            <FieldSet disabled={submit.pending}>
                <AuthField
                    form={form}
                    name="name"
                    label={labels.name}
                    autoComplete="name"
                    placeholder={t("placeholder.name")}
                />
                <AuthField
                    form={form}
                    name="password"
                    password
                    label={labels.password}
                    autoComplete="new-password"
                >
                    <PasswordStrengthHint password={password} name={name} />
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
                {t("acceptInvite.submit")}
            </SubmitButton>
        </form>
    );
}
