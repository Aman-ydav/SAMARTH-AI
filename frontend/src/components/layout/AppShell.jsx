import { Suspense } from "react";
import { Outlet } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PrototypeNotice } from "@/components/layout/PrototypeNotice";
import { Topbar } from "@/components/layout/Topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { selectSidebarCollapsed, sidebarSet } from "@/features/preferences";

/**
 * Frame for signed-in pages (UI-61): collapsible sidebar, sticky topbar, prototype notice and the routed page. Every page
 * renders its own `<main id="main-content" tabIndex={-1}>`, so the shell adds no landmark of its own. The collapse state lives in the
 * `ui` slice (stored as `sai-sidebar` by the preferences listener) and is shared with the sidebar shortcut (Ctrl/Cmd+B). Route
 * guards sit above this layout; it never imports motion or Lenis (ANIM-05).
 */
export function AppShell() {
    const dispatch = useAppDispatch();
    const collapsed = useAppSelector(selectSidebarCollapsed);

    return (
        <TooltipProvider>
            <SidebarProvider
                open={!collapsed}
                onOpenChange={(open) => dispatch(sidebarSet(!open))}
            >
                <AppSidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                    <Topbar />
                    <div className="relative flex w-full flex-1 flex-col bg-background">
                        <PrototypeNotice />
                        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
                            <Suspense fallback={<PageSkeleton />}>
                                <Outlet />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </SidebarProvider>
        </TooltipProvider>
    );
}
