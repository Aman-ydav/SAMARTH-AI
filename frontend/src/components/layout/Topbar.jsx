import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TopbarBreadcrumbs } from "@/components/layout/TopbarBreadcrumbs";
import { UserMenu } from "@/components/layout/UserMenu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth";

/**
 * Sticky topbar of the app shell (UI-61): sidebar trigger, breadcrumbs, then language, theme, notifications and the
 * account menu. Below `sm` language and theme move into the mobile sidebar so the bar keeps trigger, title, bell, avatar.
 * Search is intentionally not shown until there is something to search.
 */
export function Topbar() {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
            <SidebarTrigger className="-ml-2" />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <TopbarBreadcrumbs />
            <div className="ml-auto flex items-center gap-1">
                <div className="hidden items-center gap-1 sm:flex">
                    <LanguageSwitch />
                    <ThemeToggle />
                </div>
                <NotificationsBell />
                <UserMenu user={user} />
            </div>
        </header>
    );
}
