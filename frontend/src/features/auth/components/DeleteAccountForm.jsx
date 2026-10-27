import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import {
    AlertDialogCancel,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { ReauthFields } from "@/features/auth/components/ReauthFields";
import { SubmitButton } from "@/components/common/SubmitButton";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { notify } from "@/hooks/useNotify";
import { buildDeleteAccountFormSchema } from "@/features/auth/schemas/settingsSchemas";
import { deleteAccount } from "@/features/auth/slice/accountSlice";
import { formatDate } from "@/lib/format";
import { isAdminRole } from "@/lib/permissions";

const FIELDS = ["confirmation", "currentPassword"];
const CODE_FIELDS = Object.freeze({ INVALID_CREDENTIALS: "currentPassword" });
const PROOF_CODES = ["REAUTH_REQUIRED", "GOOGLE_TOKEN_INVALID"];

/**
 * Content of the delete-account dialog (AUTH-56): the 30-day grace period explained, a typed confirmation phrase, and
 * re-authentication. On success the `auth` slice ends the session and the listeners reset the app and go to the log in
 * page, so the confirmation is a toast that survives the navigation. `LAST_ADMIN` and the other refusals show above the button.
 */
export function DeleteAccountForm({ user }) {
    const { t, i18n } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const hasPassword = user.hasPassword !== false;
    const phrase = t("settings.delete.phrase");
    const [credential, setCredential] = useState(null);
    const form = useForm({
        resolver: zodResolver(
            buildDeleteAccountFormSchema(phrase, {
                requiresPassword: hasPassword,
            })
        ),
        defaultValues: { confirmation: "", currentPassword: "" },
    });
    const submit = useAuthFormSubmit(form, FIELDS, CODE_FIELDS);
    const ready = hasPassword || credential !== null;

    const onSubmit = form.handleSubmit((values) =>
        submit.run(
            async () => {
                const proof = hasPassword
                    ? { currentPassword: values.currentPassword }
                    : { credential };
                const result = await dispatch(deleteAccount(proof)).unwrap();
                const date = formatDate(result?.graceEndsAt, i18n.language);
                await notify(
                    "success",
                    date
                        ? t("settings.delete.scheduled", { date })
                        : t("settings.delete.scheduledNoDate"),
                    "account-deleted"
                );
            },
            (error) => {
                if (PROOF_CODES.includes(error.code)) setCredential(null);
                return false;
            }
        )
    );

    return (
        <form
            noValidate
            onSubmit={onSubmit}
            aria-busy={submit.pending}
            className="grid gap-4"
        >
            <AlertDialogHeader>
                <AlertDialogTitle>
                    {t("settings.delete.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                    {t("settings.delete.body")}
                </AlertDialogDescription>
            </AlertDialogHeader>
            {isAdminRole(user) && (
                <p className="text-sm text-muted-foreground">
                    {t("settings.delete.adminNote")}
                </p>
            )}
            <FieldSet disabled={submit.pending}>
                <AuthField
                    form={form}
                    name="confirmation"
                    label={t("settings.delete.confirmation", { phrase })}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
                <ReauthFields
                    form={form}
                    hasPassword={hasPassword}
                    credential={credential}
                    onCredential={setCredential}
                    onReset={() => setCredential(null)}
                />
            </FieldSet>
            <FormFailureAlert
                failure={submit.failure}
                cooldownSec={submit.cooldownSec}
            />
            <AlertDialogFooter>
                <AlertDialogCancel type="button" disabled={submit.pending}>
                    {t("common:cancel")}
                </AlertDialogCancel>
                <SubmitButton
                    variant="destructive"
                    pending={submit.pending}
                    disabled={!ready || submit.cooldownSec > 0}
                    className="sm:w-auto"
                >
                    {t("settings.delete.submit")}
                </SubmitButton>
            </AlertDialogFooter>
        </form>
    );
}
