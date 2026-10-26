import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { ArrowRightIcon, LogoutIcon, MenuIcon } from "@/components/icons";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth, useSignOut } from "@/features/auth";
import { cn } from "@/lib/utils";
import { MARKETING_LINKS, getDisplayName } from "@/lib/navigation";
import { PATHS } from "@/lib/paths";

const linkClass =
    "flex h-11 items-center rounded-md px-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground";

/**
 * Marketing menu below `lg` (UI-60): a Sheet from the right with stacked links, language and theme, and the
 * account actions at the bottom. Radix gives it a focus trap and scroll lock; every link closes it.
 */
export function MobileNavSheet() {
    const { t } = useTranslation("nav");
    const { pathname, hash } = useLocation();
    const { user, isAuthenticated } = useAuth();
    const { pending, signOut } = useSignOut();
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label={t("openMenu")}
                >
                    <MenuIcon className="size-5" aria-hidden="true" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>{t("menu")}</SheetTitle>
                    <SheetDescription className="sr-only">
                        {t("menuDescription")}
                    </SheetDescription>
                </SheetHeader>
                <nav aria-label={t("mobileNavigation")} className="px-4">
                    <ul className="flex flex-col gap-1">
                        <li>
                            <SheetClose asChild>
                                <Link
                                    to={PATHS.home}
                                    className={linkClass}
                                    aria-current={
                                        pathname === PATHS.home && !hash
                                            ? "page"
                                            : undefined
                                    }
                                >
                                    {t("home")}
                                </Link>
                            </SheetClose>
                        </li>
                        {MARKETING_LINKS.map((link) => {
                            const active = !link.hash && pathname === link.to;
                            return (
                                <li key={link.id}>
                                    <SheetClose asChild>
                                        <Link
                                            to={{
                                                pathname: link.to,
                                                hash: link.hash ?? "",
                                            }}
                                            className={cn(linkClass)}
                                            aria-current={
                                                active ? "page" : undefined
                                            }
                                        >
                                            {t(link.labelKey)}
                                        </Link>
                                    </SheetClose>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="flex items-center gap-2 px-4">
                    <LanguageSwitch showLabel />
                    <ThemeToggle />
                </div>
                <SheetFooter>
                    {isAuthenticated ? (
                        <>
                            <div className="flex flex-col gap-1 px-1 pb-2">
                                <span className="text-sm font-medium wrap-break-word text-foreground">
                                    {getDisplayName(user)}
                                </span>
                                <span className="text-xs wrap-break-word text-muted-foreground">
                                    {user?.email}
                                </span>
                                <RoleBadge role={user?.role} />
                            </div>
                            <SheetClose asChild>
                                <Button asChild size="lg">
                                    <Link to={PATHS.dashboard}>
                                        {t("openDashboard")}
                                    </Link>
                                </Button>
                            </SheetClose>
                            <Button
                                variant="outline"
                                size="lg"
                                disabled={Boolean(pending)}
                                aria-busy={pending ? "true" : undefined}
                                onClick={signOut}
                            >
                                <LogoutIcon aria-hidden="true" />
                                {pending
                                    ? t("account.loggingOut")
                                    : t("logout")}
                            </Button>
                        </>
                    ) : (
                        <>
                            <SheetClose asChild>
                                <Button asChild variant="outline" size="lg">
                                    <Link to={PATHS.login}>{t("login")}</Link>
                                </Button>
                            </SheetClose>
                            <SheetClose asChild>
                                <Button asChild size="lg">
                                    <Link to={PATHS.getStarted}>
                                        {t("getStarted")}
                                        <ArrowRightIcon aria-hidden="true" />
                                    </Link>
                                </Button>
                            </SheetClose>
                        </>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
