import { useTranslation } from "react-i18next";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { useAuth } from "@/features/auth";
import { HelpFaq } from "@/features/help/components/HelpFaq";
import { HelpSection } from "@/features/help/components/HelpSection";
import { useHelpSections } from "@/features/help/hooks/useHelpSections";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * `/help`, opened from the sidebar footer: what each part of SAMARTH AI does and what is built yet, for the signed-in role
 * only (everyone's basics first, then the learner, trainer, admin or platform-admin areas), then common questions.
 * The content is static, so there is no loading or error state. Open to every signed-in role.
 */
export default function HelpPage() {
    const { t } = useTranslation(["help", "common"]);
    const { user } = useAuth();
    const sections = useHelpSections();

    useDocumentTitle(t("common:documentTitle", { page: t("help:page.title") }));

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-8 outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">
                    {t("help:page.title")}
                </h1>
                <p className="type-body max-w-prose text-muted-foreground">
                    {t("help:page.subtitle")}
                </p>
                <p className="type-small flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{t("help:page.roleLine")}</span>
                    <RoleBadge role={user?.role} />
                </p>
            </header>
            {sections.map((section) => (
                <HelpSection key={section.id} section={section} />
            ))}
            <HelpFaq />
        </main>
    );
}
