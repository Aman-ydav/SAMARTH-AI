import { useTranslation } from "react-i18next";
import { LegalDocument } from "@/features/marketing/components/LegalDocument";
import { TERMS_SECTIONS } from "@/features/marketing/data/legalMeta";
import { PATHS } from "@/lib/paths";

/** `/terms`: Terms of Use draft with the stable anchors of docs/23 section 5.2. */
export default function TermsPage() {
    const { t } = useTranslation("legal");
    return (
        <LegalDocument
            docKey="terms"
            title={t("terms.title")}
            intro={t("terms.intro")}
            sections={TERMS_SECTIONS}
            related={{ to: PATHS.privacy, label: t("terms.relatedLink") }}
        />
    );
}
