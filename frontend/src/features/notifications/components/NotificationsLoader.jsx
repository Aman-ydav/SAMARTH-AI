import { Suspense, lazy } from "react";
import { NotificationsBoundary } from "@/features/notifications/components/NotificationsBoundary";

// The bell, its list and the icons load only when the signed-in shell mounts, so none of it is in the entry chunk (FE-111, UI-31).
const NotificationsMenu = lazy(() =>
    import("@/features/notifications/components/NotificationsMenu").then(
        (module) => ({ default: module.NotificationsMenu })
    )
);

/**
 * What the top bar mounts: the live bell, loaded on demand and wrapped in its own error boundary (FE-94). `fallback` is
 * the plain bell the shell passes in: it shows while the chunk loads and replaces the widget if loading or rendering fails,
 * so a broken widget or a failed chunk download never takes the page down. This file imports no icons or UI components.
 */
export function NotificationsLoader({ fallback }) {
    return (
        <NotificationsBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
                <NotificationsMenu />
            </Suspense>
        </NotificationsBoundary>
    );
}
