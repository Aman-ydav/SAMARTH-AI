import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { CompassIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { PATHS } from "@/lib/paths";

export default function NotFoundPage() {
    const { t } = useTranslation("errors");
    const navigate = useNavigate();
    const location = useLocation();
    // "default" is the first history entry of the session; going back there would leave the app.
    const canGoBack = location.key !== "default";

    return (
        <StatePage
            icon={CompassIcon}
            title={t("notFound.title")}
            body={t("notFound.body")}
            primary={{ label: t("notFound.primary"), to: PATHS.home }}
            secondary={
                canGoBack
                    ? {
                          label: t("notFound.secondary"),
                          onClick: () => navigate(-1),
                      }
                    : undefined
            }
        />
    );
}
