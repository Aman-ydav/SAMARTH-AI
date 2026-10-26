import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { resendVerificationSchema } from "@/features/auth/schemas/authSchemas";
import { resendVerification } from "@/features/auth/slice/registrationSlice";
import { useCountdown } from "@/hooks/useCountdown";

const FIELDS = ["email"];
const COOLDOWN_SEC = 60;

/**
 * "Send me a new verification link" for a visitor whose link failed and who has no pending email in state.
 * The reply is always the same neutral sentence (AUTH-30) and resubmitting waits for the 60 s cooldown.
 */
export function RequestLinkForm({ defaultEmail = "" }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const [sent, setSent] = useState(false);
    const cooldown = useCountdown();
    const form = useForm({
        resolver: zodResolver(resendVerificationSchema),
        defaultValues: { email: defaultEmail },
    });
    const submit = useAuthFormSubmit(form, FIELDS);

    const onSubmit = form.handleSubmit((values) =>
        submit.run(async () => {
            await dispatch(resendVerification(values)).unwrap();
            setSent(true);
            cooldown.startFor(COOLDOWN_SEC);
        })
    );

    return (
        <form
            noValidate
            onSubmit={onSubmit}
            aria-busy={submit.pending}
            className="flex flex-col gap-4"
        >
            <p className="text-sm text-muted-foreground">
                {t("requestLink.intro")}
            </p>
            <FieldSet disabled={submit.pending}>
                <AuthField
                    form={form}
                    name="email"
                    type="email"
                    label={t("email")}
                    autoComplete="email"
                    placeholder={t("placeholder.email")}
                />
            </FieldSet>
            {sent && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("requestLink.sent")}
                </p>
            )}
            <FormFailureAlert
                failure={submit.failure}
                cooldownSec={submit.cooldownSec}
            />
            <SubmitButton
                pending={submit.pending}
                disabled={cooldown.isRunning || submit.cooldownSec > 0}
            >
                {cooldown.isRunning
                    ? t("resend.cooldown", { seconds: cooldown.remainingSec })
                    : t("requestLink.submit")}
            </SubmitButton>
        </form>
    );
}
