import { useTranslation } from "react-i18next";
import { useLocation, useMatches } from "react-router";
import { HourglassIcon } from "@/components/icons";
import { StatePage } from "@/features/marketing/components/StatePage";
import { PATHS } from "@/lib/paths";

const TITLE_KEY = /^[a-z]+:[A-Za-z0-9_.]+$/;

/**
 * `/coming-soon` and every sidebar destination that is not built yet. The feature name comes from the route
 * handle (`handle.title`, an i18n key such as `nav:sidebar.gaps`) or from `state.feature` (a key in the same
 * form). Anything that is not an existing key is ignored. Needs a data router, as all app routes use.
 */
export default function ComingSoonPage() {
    const { t, i18n } = useTranslation(["errors", "nav", "common"]);
    const { pathname, state } = useLocation();
    const matches = useMatches();

    const handleKey =
        pathname === PATHS.comingSoon
            ? undefined
            : matches.findLast((match) => match.handle?.title)?.handle.title;
    const candidate = [state?.feature, handleKey].find(
        (key) => typeof key === "string" && TITLE_KEY.test(key)
    );
    const feature = candidate && i18n.exists(candidate) ? t(candidate) : "";

    return (
        <StatePage
            icon={HourglassIcon}
            title={t("comingSoon.title")}
            body={
                feature
                    ? t("pages.comingSoon.featureLine", { feature })
                    : t("comingSoon.body")
            }
            primary={{ label: t("comingSoon.primary"), to: PATHS.dashboard }}
            secondary={{ label: t("comingSoon.secondary"), to: PATHS.home }}
        />
    );
}
