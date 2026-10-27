import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { CheckCircleIcon } from "@/components/icons";
import { FieldSet } from "@/components/ui/field";
import { AuthField } from "@/features/auth/components/AuthField";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { SettingsSelectField } from "@/features/auth/components/SettingsSelectField";
import { SubmitButton } from "@/components/common/SubmitButton";
import { UnsavedChangesDialog } from "@/features/auth/components/UnsavedChangesDialog";
import { useAuthFormSubmit } from "@/features/auth/hooks/useAuthFormSubmit";
import { useTimeZoneOptions } from "@/features/auth/hooks/useTimeZoneOptions";
import { useUnsavedChangesGuard } from "@/features/auth/hooks/useUnsavedChangesGuard";
import {
    PROFILE_LOCALES,
    diffProfile,
    profileSchema,
} from "@/features/auth/schemas/settingsSchemas";
import { updateProfile } from "@/features/auth/slice/profileSlice";
import { useLanguage } from "@/features/preferences";

const FIELDS = ["name", "locale", "timezone"];

const savedValues = (user, timezone) => ({
    name: user.name ?? "",
    locale: PROFILE_LOCALES.includes(user.locale) ? user.locale : "en",
    timezone,
});

/**
 * Name, language and time zone (`PUT /profile` accepts only these). Only changed fields are sent and a pristine form cannot
 * submit (EDGE-107). A new language also switches the interface. Leaving with unsaved edits asks first.
 */
export function ProfileForm({ user, timezone }) {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const { language, setLanguage } = useLanguage();
    const zones = useTimeZoneOptions(timezone);
    /* Stable option arrays keep the memoised select fields from re-rendering their ~400 items on each keystroke. */
    const localeOptions = useMemo(
        () =>
            PROFILE_LOCALES.map((value) => ({
                value,
                label: t(`common:language.${value}`),
            })),
        [t]
    );
    const zoneOptions = useMemo(
        () => zones.map((zone) => ({ value: zone, label: zone })),
        [zones]
    );
    const [saved, setSaved] = useState(false);
    const form = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: savedValues(user, timezone),
    });
    const submit = useAuthFormSubmit(form, FIELDS);
    const { isDirty } = form.formState;
    const blocker = useUnsavedChangesGuard(isDirty && !submit.pending);

    const onSubmit = form.handleSubmit((values) =>
        submit.run(async () => {
            const patch = diffProfile(values, savedValues(user, timezone));
            if (Object.keys(patch).length === 0) {
                form.reset(values);
                return;
            }
            const result = await dispatch(updateProfile(patch)).unwrap();
            form.reset(
                savedValues(result.user, result.timezone ?? values.timezone)
            );
            if (patch.locale && patch.locale !== language)
                setLanguage(patch.locale);
            setSaved(true);
        })
    );

    return (
        <>
            <form
                noValidate
                onSubmit={onSubmit}
                aria-busy={submit.pending}
                className="flex flex-col gap-6"
            >
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">
                        {t("settings.profile.details.email")}
                    </p>
                    <p className="text-sm break-all text-muted-foreground">
                        {user.email}
                    </p>
                </div>
                <FieldSet disabled={submit.pending}>
                    <AuthField
                        form={form}
                        name="name"
                        label={t("settings.profile.details.name")}
                        autoComplete="name"
                    />
                    <SettingsSelectField
                        form={form}
                        name="locale"
                        label={t("settings.profile.details.locale")}
                        lang
                        options={localeOptions}
                    />
                    <SettingsSelectField
                        form={form}
                        name="timezone"
                        label={t("settings.profile.details.timezone")}
                        description={t("settings.profile.details.timezoneHelp")}
                        options={zoneOptions}
                    />
                </FieldSet>
                {saved && !isDirty && (
                    <p
                        role="status"
                        className="flex items-center gap-2 text-sm"
                    >
                        <CheckCircleIcon
                            aria-hidden="true"
                            className="size-4 text-success-subtle-foreground"
                        />
                        {t("settings.profile.details.saved")}
                    </p>
                )}
                <FormFailureAlert
                    failure={submit.failure}
                    cooldownSec={submit.cooldownSec}
                />
                <SubmitButton
                    pending={submit.pending}
                    disabled={!isDirty || submit.cooldownSec > 0}
                    className="sm:w-fit"
                >
                    {t("settings.profile.details.save")}
                </SubmitButton>
            </form>
            <UnsavedChangesDialog blocker={blocker} />
        </>
    );
}
