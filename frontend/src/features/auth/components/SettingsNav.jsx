import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { PATHS } from "@/lib/paths";

const ITEMS = [
    { id: "profile", to: PATHS.settingsProfile },
    { id: "security", to: PATHS.settingsSecurity },
    { id: "sessions", to: PATHS.settingsSessions },
];

/** In-page navigation between the account settings screens; the current one carries `aria-current="page"`. */
export function SettingsNav() {
    const { t } = useTranslation("auth");
    const { pathname } = useLocation();

    return (
        <nav aria-label={t("settings.nav.label")}>
            <ul className="flex gap-1 overflow-x-auto border-b border-border pb-2">
                {ITEMS.map(({ id, to }) => {
                    const active = pathname === to;
                    return (
                        <li key={id}>
                            <Button
                                asChild
                                size="sm"
                                variant={active ? "secondary" : "ghost"}
                            >
                                <Link
                                    to={to}
                                    aria-current={active ? "page" : undefined}
                                >
                                    {t(`settings.nav.${id}`)}
                                </Link>
                            </Button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
