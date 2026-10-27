import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { FieldSet } from "@/components/ui/field";
import { AuthCheckboxField } from "@/features/auth/components/AuthCheckboxField";
import { AuthField } from "@/features/auth/components/AuthField";
import { ErrorSummary } from "@/features/auth/components/ErrorSummary";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { PasswordStrengthHint } from "@/features/auth/components/PasswordStrengthHint";
import { SubmitButton } from "@/components/common/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { useSignInFlow } from "@/features/auth/hooks/useSignInFlow";
import {
    registerSchema,
    toRegisterBody,
} from "@/features/auth/schemas/authSchemas";
import { registerUser } from "@/features/auth/slice/registrationSlice";
import { PATHS } from "@/lib/paths";

const FIELDS = ["name", "email", "password", "confirmPassword", "acceptTerms"];
const CODE_FIELDS = Object.freeze({
    DOMAIN_NOT_ALLOWED: "email",
    PASSWORD_POLICY: "password",
});
const EMPTY_VALUES = Object.freeze({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
});

const newTabLink = { target: "_blank", rel: "noopener noreferrer" };

/**
 * Account creation (doc 20 section 3). The answer is always the neutral "check your inbox" screen, whether the
 * address is new, existing or pending (AUTH-27); only a disallowed domain is rejected explicitly. The password
 * checklist counts UTF-8 bytes live because the server limit is 72 bytes, not characters (R4).
 */
export function SignupForm({ defaultValues }) {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const flow = useSignInFlow();
    const [summarySignal, setSummarySignal] = useState(0);
    const form = useForm({
        resolver: zodResolver(registerSchema),
        shouldFocusError: false,
        defaultValues: { ...EMPTY_VALUES, ...defaultValues },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const [password, email, name] = useWatch({
        control: form.control,
        name: ["password", "email", "name"],
    });
    const labels = {
        name: t("name"),
        email: t("email"),
        password: t("password"),
        confirmPassword: t("confirmPassword"),
        acceptTerms: t("signup.terms"),
    };

    const onSubmit = form.handleSubmit(
        (values) =>
            submit.run(async () => {
                await dispatch(registerUser(toRegisterBody(values))).unwrap();
                navigate(PATHS.verifyEmailSent);
            }),
        () => setSummarySignal((count) => count + 1)
    );

    return (
        <div className="flex flex-col gap-6">
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
                        name="email"
                        type="email"
                        label={labels.email}
                        autoComplete="email"
                        placeholder={t("placeholder.email")}
                    />
                    <AuthField
                        form={form}
                        name="password"
                        password
                        label={labels.password}
                        autoComplete="new-password"
                        description={t("signup.passwordHelp")}
                    >
                        <PasswordStrengthHint
                            password={password}
                            email={email}
                            name={name}
                        />
                    </AuthField>
                    <AuthField
                        form={form}
                        name="confirmPassword"
                        password
                        label={labels.confirmPassword}
                        autoComplete="new-password"
                    />
                    <AuthCheckboxField
                        form={form}
                        name="acceptTerms"
                        label={
                            <span>
                                <Trans
                                    i18nKey="signup.consentLabel"
                                    ns="auth"
                                    components={{
                                        terms: (
                                            <a
                                                href={PATHS.terms}
                                                className="text-primary-text underline underline-offset-4"
                                                {...newTabLink}
                                            />
                                        ),
                                        privacy: (
                                            <a
                                                href={PATHS.privacy}
                                                className="text-primary-text underline underline-offset-4"
                                                {...newTabLink}
                                            />
                                        ),
                                    }}
                                />
                                <span className="sr-only">
                                    {t("common:opensInNewTab")}
                                </span>
                            </span>
                        }
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
                    {t("createAccount")}
                </SubmitButton>
            </form>
            <GoogleButton
                onSession={flow.onSuccess}
                onFailure={flow.onFailure}
            />
        </div>
    );
}
