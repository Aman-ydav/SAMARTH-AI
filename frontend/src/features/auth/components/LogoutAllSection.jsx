import { useTranslation } from "react-i18next";
import { LogoutAllButton } from "@/features/auth/components/LogoutAllButton";
import { SectionCard } from "@/features/auth/components/SectionCard";

/** Security card for ending every session at once, including this device. */
export function LogoutAllSection() {
    const { t } = useTranslation("auth");
    return (
        <SectionCard
            title={t("settings.logoutAll.heading")}
            description={t("settings.logoutAll.description")}
        >
            <LogoutAllButton className="w-fit" />
        </SectionCard>
    );
}
