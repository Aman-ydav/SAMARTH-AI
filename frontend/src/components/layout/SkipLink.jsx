import { useTranslation } from "react-i18next";

/** Skip-to-content link: the first focusable element on every page (FE-70, UI-60). Targets `<main id="main-content">`. */
export function SkipLink() {
    const { t } = useTranslation("nav");
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
            {t("skipToContent")}
        </a>
    );
}
