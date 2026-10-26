import { useTranslation } from "react-i18next";
import { CheckCircleIcon, InfoIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/features/auth/components/AuthField";
import { GoogleCredentialButton } from "@/features/auth/components/GoogleCredentialButton";
import { env } from "@/lib/env";

/**
 * Proof of presence for a sensitive change (AUTH-55): the current password for accounts that have one, otherwise a fresh
 * Google credential held by the parent form in `credential`. `form` is the react-hook-form instance that owns
 * `currentPassword`. The submit button of the parent stays disabled until Google has confirmed.
 */
export function ReauthFields({
    form,
    hasPassword,
    credential,
    onCredential,
    onReset,
}) {
    const { t } = useTranslation("auth");

    if (hasPassword)
        return (
            <AuthField
                form={form}
                name="currentPassword"
                password
                label={t("currentPassword")}
                autoComplete="current-password"
            />
        );

    if (!env.googleEnabled)
        return (
            <Alert variant="warning">
                <InfoIcon aria-hidden="true" />
                <AlertDescription>
                    {t("settings.reauth.googleUnavailable")}
                </AlertDescription>
            </Alert>
        );

    if (credential)
        return (
            <div className="flex flex-wrap items-center gap-3">
                <p role="status" className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon
                        aria-hidden="true"
                        className="size-4 text-success-subtle-foreground"
                    />
                    {t("settings.reauth.googleConfirmed")}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onReset}
                >
                    {t("settings.reauth.googleAgain")}
                </Button>
            </div>
        );

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
                {t("settings.reauth.googleHelp")}
            </p>
            <GoogleCredentialButton onCredential={onCredential} />
            <p className="text-sm text-muted-foreground">
                {t("settings.reauth.googleRequired")}
            </p>
        </div>
    );
}
