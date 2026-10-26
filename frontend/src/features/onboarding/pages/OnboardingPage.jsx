import { useTranslation } from "react-i18next";

export default function OnboardingPage() {
    const { t } = useTranslation("common");
    return (
        <main id="main-content" tabIndex={-1}>
            <h1>{t("pages.onboarding")}</h1>
        </main>
    );
}
