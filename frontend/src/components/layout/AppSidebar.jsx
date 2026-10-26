import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import * as Icons from "@/components/icons";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, useSignOut } from "@/features/auth";
import { getNavGroups, isNavItemActive } from "@/lib/navigation";
import { PATHS } from "@/lib/paths";

/**
 * Collapsible role-aware sidebar (UI-61). Items come from `lib/navigation.js` filtered by the signed-in role
 * (hidden, never disabled); the active item gets the sidebar-accent fill and the primary bar from the shadcn
 * component; collapsed items show a tooltip; below `md` it is the off-canvas Sheet and closes on navigation.
 */
export function AppSidebar() {
    const { t } = useTranslation("nav");
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { state, isMobile, setOpenMobile } = useSidebar();
    const { pending, signOut } = useSignOut();
    const groups = getNavGroups(user);
    const collapsed = state === "collapsed" && !isMobile;
    const closeMobile = () => {
        if (isMobile) setOpenMobile(false);
    };

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
                <Link
                    to={PATHS.dashboard}
                    className="rounded-md"
                    onClick={closeMobile}
                >
                    <Logo showWordmark={!collapsed} />
                </Link>
            </SidebarHeader>
            <SidebarContent>
                <nav
                    aria-label={t("shell.sidebarLabel")}
                    className="flex flex-col gap-2"
                >
                    {groups.map((group) => (
                        <SidebarGroup key={group.id}>
                            <SidebarGroupLabel>
                                {t(group.labelKey)}
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {group.items.map((entry) => {
                                        const Icon = Icons[entry.icon];
                                        const label = t(entry.labelKey);
                                        const active = isNavItemActive(
                                            entry,
                                            pathname
                                        );
                                        return (
                                            <SidebarMenuItem key={entry.id}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={active}
                                                    tooltip={label}
                                                >
                                                    <Link
                                                        to={entry.to}
                                                        aria-current={
                                                            active
                                                                ? "page"
                                                                : undefined
                                                        }
                                                        onClick={closeMobile}
                                                    >
                                                        {Icon ? (
                                                            <Icon aria-hidden="true" />
                                                        ) : null}
                                                        <span>{label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        );
                                    })}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ))}
                </nav>
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border">
                {isMobile ? (
                    <div
                        role="group"
                        aria-label={t("shell.preferences")}
                        className="flex items-center gap-2 px-2"
                    >
                        <LanguageSwitch showLabel />
                        <ThemeToggle />
                    </div>
                ) : null}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip={t("shell.help")}>
                            <Link to={PATHS.comingSoon} onClick={closeMobile}>
                                <Icons.HelpIcon aria-hidden="true" />
                                <span>{t("shell.help")}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            type="button"
                            tooltip={t("shell.signOut")}
                            disabled={Boolean(pending)}
                            aria-busy={pending ? "true" : undefined}
                            onClick={signOut}
                        >
                            <Icons.LogoutIcon aria-hidden="true" />
                            <span>
                                {pending
                                    ? t("shell.signingOut")
                                    : t("shell.signOut")}
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <Badge
                    variant="outline"
                    className="mx-2 w-fit group-data-[collapsible=icon]:hidden"
                >
                    {t("common:prototype")}
                </Badge>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
