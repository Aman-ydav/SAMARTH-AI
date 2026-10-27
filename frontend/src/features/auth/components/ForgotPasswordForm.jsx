import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { SubmitButton } from "@/components/common/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { forgotPasswordSchema } from "@/features/auth/schemas/authSchemas";
import { forgotPassword } from "@/features/auth/slice/accountSlice";

const FIELDS = ["email"];

/**
 * Asks for a password-reset link. The answer is always the same neutral confirmation (AUTH-46), so the caller
 * only learns that the request was accepted; an IP rate limit shows a countdown and blocks resubmitting.
 */
export function ForgotPasswordForm({ onSent, defaultEmail = "" }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const form = useForm({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: defaultEmail },
    });
    const submit = useAuthFormSubmit(form, FIELDS);

    const onSubmit = form.handleSubmit((values) =>
        submit.run(async () => {
            await dispatch(forgotPassword(values)).unwrap();
            onSent(values.email);
        })
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
                    name="email"
                    type="email"
                    label={t("email")}
                    autoComplete="email"
                    placeholder={t("placeholder.email")}
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
                {t("sendReset")}
            </SubmitButton>
        </form>
    );
}
