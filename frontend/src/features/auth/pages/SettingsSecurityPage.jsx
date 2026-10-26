import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/app/hooks";
import { DeleteAccountSection } from "@/features/auth/components/DeleteAccountSection";
import { EmailChangeSection } from "@/features/auth/components/EmailChangeSection";
import { GoogleLinkSection } from "@/features/auth/components/GoogleLinkSection";
import { LogoutAllSection } from "@/features/auth/components/LogoutAllSection";
import { PasswordSection } from "@/features/auth/components/PasswordSection";
import { SettingsLayout } from "@/features/auth/components/SettingsLayout";
import { SettingsSkeleton } from "@/features/auth/components/SettingsSkeleton";
import { selectCurrentUser } from "@/features/auth/slice/authSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * `/settings/security`: email change, password, Google link, log out everywhere and account deletion (AUTH-55, AUTH-56).
 * Every change that needs proof asks for the current password, or a fresh Google credential for Google-only accounts.
 */
export default function SettingsSecurityPage() {
    const { t } = useTranslation(["auth", "common"]);
    const user = useAppSelector(selectCurrentUser);

    useDocumentTitle(
        t("common:documentTitle", { page: t("settings.security.title") })
    );

    return (
        <SettingsLayout
            title={t("settings.security.title")}
            description={t("settings.security.subtitle")}
        >
            {user ? (
                <>
                    <EmailChangeSection user={user} />
                    <PasswordSection user={user} />
                    <GoogleLinkSection user={user} />
                    <LogoutAllSection />
                    <DeleteAccountSection user={user} />
                </>
            ) : (
                <SettingsSkeleton rows={4} />
            )}
        </SettingsLayout>
    );
}
