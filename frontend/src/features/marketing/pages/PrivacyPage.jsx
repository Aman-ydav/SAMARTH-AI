import { useTranslation } from "react-i18next";
import { LegalCookieTable } from "@/features/marketing/components/LegalCookieTable";
import { LegalDocument } from "@/features/marketing/components/LegalDocument";
import { PRIVACY_SECTIONS } from "@/features/marketing/data/legalMeta";
import { PATHS } from "@/lib/paths";

const EXTRAS = { cookies: <LegalCookieTable /> };

/** `/privacy`: Privacy Policy draft with the stable anchors of docs/23 section 5.1 (including `#cookies`). */
export default function PrivacyPage() {
    const { t } = useTranslation("legal");
    return (
        <LegalDocument
            docKey="privacy"
            title={t("privacy.title")}
            intro={t("privacy.intro")}
            sections={PRIVACY_SECTIONS}
            extras={EXTRAS}
            related={{ to: PATHS.terms, label: t("privacy.relatedLink") }}
        />
    );
}
