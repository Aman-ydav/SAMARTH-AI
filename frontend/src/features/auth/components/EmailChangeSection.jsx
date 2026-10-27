import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { CheckCircleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { ReauthFields } from "@/features/auth/components/ReauthFields";
import { SectionCard } from "@/features/auth/components/SectionCard";
import { SubmitButton } from "@/components/common/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { buildChangeEmailFormSchema } from "@/features/auth/schemas/settingsSchemas";
import { changeEmail } from "@/features/auth/slice/accountSlice";

const FIELDS = ["newEmail", "currentPassword"];
const CODE_FIELDS = Object.freeze({
    INVALID_CREDENTIALS: "currentPassword",
    DOMAIN_NOT_ALLOWED: "newEmail",
});
const PROOF_CODES = ["REAUTH_REQUIRED", "GOOGLE_TOKEN_INVALID"];

/**
 * Request an email change (AUTH-55, R38). The answer is always the same neutral 202, so the confirmation never says whether
 * the address is free; the address changes only after the link sent to the NEW address is opened (`/confirm-email-change`).
 */
export function EmailChangeSection({ user }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const hasPassword = user.hasPassword !== false;
    const [credential, setCredential] = useState(null);
    const [sentTo, setSentTo] = useState(null);
    const form = useForm({
        resolver: zodResolver(
            buildChangeEmailFormSchema(user.email, {
                requiresPassword: hasPassword,
            })
        ),
        defaultValues: { newEmail: "", currentPassword: "" },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const ready = hasPassword || credential !== null;

    const onSubmit = form.handleSubmit((values) =>
        submit.run(
            async () => {
                const proof = hasPassword
                    ? { currentPassword: values.currentPassword }
                    : { credential };
                await dispatch(
                    changeEmail({ newEmail: values.newEmail, ...proof })
                ).unwrap();
                setSentTo(values.newEmail);
                setCredential(null);
                form.reset();
            },
            (error) => {
                if (PROOF_CODES.includes(error.code)) setCredential(null);
                return false;
            }
        )
    );

    return (
        <SectionCard
            title={t("settings.email.heading")}
            description={t("settings.email.description")}
        >
            <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                    {t("settings.email.current")}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="break-all">{user.email}</span>
                    {user.emailVerified && (
                        <Badge variant="success">
                            <CheckCircleIcon aria-hidden="true" />
                            {t("settings.email.verified")}
                        </Badge>
                    )}
                </p>
            </div>
            <form
                noValidate
                onSubmit={onSubmit}
                aria-busy={submit.pending}
                className="flex max-w-md flex-col gap-6"
            >
                <FieldSet disabled={submit.pending}>
                    <AuthField
                        form={form}
                        name="newEmail"
                        type="email"
                        label={t("settings.email.newEmail")}
                        autoComplete="email"
                        placeholder={t("placeholder.email")}
                    />
                    <ReauthFields
                        form={form}
                        hasPassword={hasPassword}
                        credential={credential}
                        onCredential={setCredential}
                        onReset={() => setCredential(null)}
                    />
                </FieldSet>
                {sentTo && (
                    <p role="status" className="text-sm">
                        {t("settings.email.sent", { email: sentTo })}
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
                    {t("settings.email.submit")}
                </SubmitButton>
            </form>
        </SectionCard>
    );
}
