import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { AvatarEditor } from "@/features/auth/components/AvatarEditor";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { SectionCard } from "@/features/auth/components/SectionCard";
import { SettingsLayout } from "@/features/auth/components/SettingsLayout";
import { SettingsLoadError } from "@/features/auth/components/SettingsLoadError";
import { SettingsSkeleton } from "@/features/auth/components/SettingsSkeleton";
import { selectCurrentUser } from "@/features/auth/slice/authSlice";
import {
    fetchProfile,
    selectProfileError,
    selectProfileStatus,
    selectProfileTimezone,
} from "@/features/auth/slice/profileSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { STATUS } from "@/lib/asyncState";

/**
 * `/settings/profile`: profile photo plus name, language and time zone. The photo only needs the signed-in user; the form
 * waits for `GET /profile` (the time zone is not part of `/auth/me`) and offers a retry when that read fails.
 */
export default function SettingsProfilePage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectCurrentUser);
    const timezone = useAppSelector(selectProfileTimezone);
    const status = useAppSelector(selectProfileStatus);
    const error = useAppSelector(selectProfileError);

    useDocumentTitle(
        t("common:documentTitle", { page: t("settings.profile.title") })
    );
    useEffect(() => {
        dispatch(fetchProfile());
    }, [dispatch]);

    let details;
    if (user && timezone !== null) {
        details = <ProfileForm user={user} timezone={timezone} />;
    } else if (status === STATUS.FAILED) {
        details = (
            <SettingsLoadError
                error={error}
                onRetry={() => dispatch(fetchProfile({ force: true }))}
            />
        );
    } else {
        details = <SettingsSkeleton rows={3} />;
    }

    return (
        <SettingsLayout
            title={t("settings.profile.title")}
            description={t("settings.profile.subtitle")}
        >
            {user && <AvatarEditor user={user} />}
            <SectionCard
                title={t("settings.profile.details.heading")}
                description={t("settings.profile.details.description")}
            >
                {details}
            </SectionCard>
        </SettingsLayout>
    );
}
