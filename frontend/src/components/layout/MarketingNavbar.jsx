import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { ArrowRightIcon } from "@/components/icons";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Logo } from "@/components/layout/Logo";
import { MobileNavSheet } from "@/components/layout/MobileNavSheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useScrolled } from "@/hooks/useScrolled";
import { MARKETING_LINKS } from "@/lib/navigation";
import { PATHS } from "@/lib/paths";
import { cn } from "@/lib/utils";

/**
 * Public navbar (UI-60): sticky and flat. After ~8px of scroll only the bottom border appears; there is no blur,
 * shadow, colour change or hide-on-scroll. Links and CTAs show from `lg` (the five links plus the right cluster do
 * not fit at 768px); below that a Sheet menu takes over. Signed-in visitors get Dashboard plus the avatar menu.
 */
export function MarketingNavbar() {
    const { t } = useTranslation("nav");
    const { pathname } = useLocation();
    const { user, isAuthenticated } = useAuth();
    const scrolled = useScrolled(8);

    return (
        <header
            data-scrolled={scrolled ? "true" : "false"}
            className={cn(
                "sticky top-0 z-30 h-16 border-b bg-background transition-colors",
                scrolled ? "border-border" : "border-transparent"
            )}
        >
            <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                <Link to={PATHS.home} className="rounded-md">
                    <Logo />
                </Link>
                <nav
                    aria-label={t("mainNavigation")}
                    className="hidden lg:block"
                >
                    <ul className="flex items-center gap-1">
                        {MARKETING_LINKS.map((link) => {
                            const active = !link.hash && pathname === link.to;
                            return (
                                <li key={link.id}>
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "relative text-muted-foreground hover:text-foreground",
                                            active &&
                                                "text-foreground after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:bg-primary"
                                        )}
                                    >
                                        <Link
                                            to={{
                                                pathname: link.to,
                                                hash: link.hash ?? "",
                                            }}
                                            aria-current={
                                                active ? "page" : undefined
                                            }
                                        >
                                            {t(link.labelKey)}
                                        </Link>
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="ml-auto flex items-center gap-1">
                    <LanguageSwitch />
                    <ThemeToggle />
                    <div className="hidden items-center gap-2 pl-2 lg:flex">
                        {isAuthenticated ? (
                            <>
                                <Button asChild variant="outline">
                                    <Link to={PATHS.dashboard}>
                                        {t("openDashboard")}
                                    </Link>
                                </Button>
                                <UserMenu user={user} />
                            </>
                        ) : (
                            <>
                                <Button asChild variant="outline">
                                    <Link to={PATHS.login}>{t("login")}</Link>
                                </Button>
                                <Button asChild>
                                    <Link to={PATHS.getStarted}>
                                        {t("getStarted")}
                                        <ArrowRightIcon aria-hidden="true" />
                                    </Link>
                                </Button>
                            </>
                        )}
                    </div>
                    <MobileNavSheet />
                </div>
            </div>
        </header>
    );
}
