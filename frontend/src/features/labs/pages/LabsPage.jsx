import { useTranslation } from "react-i18next";

/** Placeholder until the virtual labs milestone. Renders its own `<main>` landmark inside AppShell. */
export default function LabsPage() {
    const { t } = useTranslation("common");
    return (
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
            <h1 className="type-h1 text-foreground">{t("pages.labs")}</h1>
        </main>
    );
}
