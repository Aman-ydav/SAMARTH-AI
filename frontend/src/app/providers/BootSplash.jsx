import { useTranslation } from "react-i18next";

/**
 * Full-screen placeholder shown until the app hydrates and while a lazy route loads. It is the one loading
 * indicator in the initial bundle, so it is a plain CSS ring and not the shadcn Spinner: that one draws a glyph from
 * the icon registry, which would pull react-icons into the entry chunk (FE-111).
 */
export function BootSplash() {
    const { t } = useTranslation("common");
    return (
        <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
            <span
                data-slot="spinner"
                role="status"
                aria-label={t("loading")}
                className="size-8 rounded-full border-4 border-current border-t-transparent motion-safe:animate-spin"
            />
        </div>
    );
}
