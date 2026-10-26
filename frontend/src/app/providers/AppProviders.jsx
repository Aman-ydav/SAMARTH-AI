import { Suspense, lazy } from "react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { useTheme } from "@/features/preferences";
import { i18n } from "@/i18n";

/* The toaster (sonner plus its icons) is not needed for first paint: it loads in its own chunk (FE-111).
   Toasts fire from user actions, long after the chunk has arrived. */
const Toaster = lazy(() =>
    import("@/components/ui/sonner").then((module) => ({
        default: module.Toaster,
    }))
);

function ThemedToaster() {
    const { theme } = useTheme();
    return (
        <Suspense fallback={null}>
            <Toaster theme={theme} />
        </Suspense>
    );
}

/** Store, i18n, theme and the single toaster around the router. Suspense for lazy namespaces is in RootLayout.
    TooltipProvider lives in the AppShell frame, the only place with tooltips. */
export function AppProviders({ store, children }) {
    return (
        <Provider store={store}>
            <I18nextProvider i18n={i18n}>
                <ThemeProvider>
                    {children}
                    <ThemedToaster />
                </ThemeProvider>
            </I18nextProvider>
        </Provider>
    );
}
