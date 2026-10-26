import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { VerifiedIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { StatePage } from "@/features/marketing/components/StatePage";
import { PATHS } from "@/lib/paths";

const CERTIFICATE_CODE = /^[A-Za-z0-9-]{1,64}$/;

/** `/verify/:code`. Placeholder: public certificate verification is planned (docs/23 section 2.1). */
export default function VerifyCertificatePage() {
    const { t } = useTranslation("errors");
    const { code } = useParams();
    const shownCode = CERTIFICATE_CODE.test(code ?? "") ? code : null;

    return (
        <StatePage
            icon={VerifiedIcon}
            title={t("pages.verifyCertificate.title")}
            body={t("pages.verifyCertificate.body")}
            primary={{
                label: t("pages.verifyCertificate.primary"),
                to: PATHS.home,
            }}
            secondary={{
                label: t("pages.verifyCertificate.secondary"),
                to: PATHS.about,
            }}
        >
            <Badge variant="outline">
                {t("pages.verifyCertificate.status")}
            </Badge>
            {shownCode ? (
                <p className="type-small text-muted-foreground">
                    {t("pages.verifyCertificate.codeLabel")}:{" "}
                    <code className="type-code text-foreground">
                        {shownCode}
                    </code>
                </p>
            ) : null}
            <p className="type-small text-muted-foreground">
                {t("pages.verifyCertificate.note")}
            </p>
        </StatePage>
    );
}
