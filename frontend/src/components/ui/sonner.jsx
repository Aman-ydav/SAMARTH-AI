import { Toaster as Sonner } from "sonner";
import {
    CheckCircleIcon,
    ErrorIcon,
    InfoIcon,
    SpinnerIcon,
    WarningIcon,
} from "@/components/icons";
import { useIsMobile } from "@/hooks/useMobile";

/* Status colours come from the -subtle token sets (UI-07). The theme comes from the app's ThemeProvider
   (prop), not next-themes. --toast-*-border bridge variables live in index.css because sonner defines
   its own --success-border/--warning-border/--info-border on the toaster element. */
const toastStyle = {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--success-bg": "var(--success-subtle)",
    "--success-text": "var(--success-subtle-foreground)",
    "--success-border": "var(--toast-success-border)",
    "--info-bg": "var(--info-subtle)",
    "--info-text": "var(--info-subtle-foreground)",
    "--info-border": "var(--toast-info-border)",
    "--warning-bg": "var(--warning-subtle)",
    "--warning-text": "var(--warning-subtle-foreground)",
    "--warning-border": "var(--toast-warning-border)",
    "--error-bg": "var(--destructive-subtle)",
    "--error-text": "var(--destructive-subtle-foreground)",
    "--error-border": "var(--destructive-border)",
    "--border-radius": "var(--radius)",
};

/* Placement (UI spec, toast row): bottom-right on desktop, bottom-center on phones, always at the bottom edge so a toast
   sits in the content area and never on the top bar (top) or the left sidebar. Toasts keep z-100 (UI-43) on purpose: a toast
   must stay in front of dialogs and menus or an error raised while one is open would be invisible. */
const DESKTOP_OFFSET = 24;
const MOBILE_OFFSET = 16;

function Toaster({ theme = "system", ...props }) {
    const isMobile = useIsMobile();
    return (
        <Sonner
            theme={theme}
            richColors
            position={isMobile ? "bottom-center" : "bottom-right"}
            offset={DESKTOP_OFFSET}
            mobileOffset={MOBILE_OFFSET}
            className="toaster group z-100! font-sans!"
            icons={{
                success: (
                    <CheckCircleIcon aria-hidden="true" className="size-4" />
                ),
                info: <InfoIcon aria-hidden="true" className="size-4" />,
                warning: <WarningIcon aria-hidden="true" className="size-4" />,
                error: <ErrorIcon aria-hidden="true" className="size-4" />,
                loading: (
                    <SpinnerIcon
                        aria-hidden="true"
                        className="size-4 motion-safe:animate-spin"
                    />
                ),
            }}
            style={toastStyle}
            toastOptions={{
                classNames: {
                    toast: "min-h-14! rounded-lg! p-4! text-sm! shadow-md!",
                },
            }}
            {...props}
        />
    );
}

export { Toaster };
