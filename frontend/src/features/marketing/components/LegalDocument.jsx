import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { InfoIcon, WarningIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LegalSection } from "@/features/marketing/components/LegalSection";
import { LegalToc } from "@/features/marketing/components/LegalToc";
import {
    LEGAL_LAST_UPDATED,
    LEGAL_VERSION,
} from "@/features/marketing/data/legalMeta";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatDate, resolveLanguage } from "@/lib/format";

/**
 * Long-form legal page shell (Privacy Policy, Terms of Use): draft notice, version and last-updated date,
 * table of contents with in-page anchors, the sections, the prototype disclaimer and a link to the sibling document.
 * `sections` is the ordered `{ id, key }` list from data/legalMeta.js, `extras` maps a section id to extra content,
 * and `related` is `{ to, label }`.
 */
export function LegalDocument({
    docKey,
    title,
    intro,
    sections,
    extras = {},
    related,
}) {
    const { t, i18n } = useTranslation("legal");
    const { hash } = useLocation();
    const language = resolveLanguage(i18n.language);
    useDocumentTitle(t("common:documentTitle", { page: title }));

    // Deep links such as /privacy#cookies: scroll to the section once the page is mounted.
    useEffect(() => {
        const id = hash.slice(1);
        if (id && sections.some((section) => section.id === id))
            document.getElementById(id)?.scrollIntoView();
    }, [hash, sections]);

    const tocItems = sections.map(({ id, key }) => ({
        id,
        title: t(`${docKey}.sections.${key}.title`),
    }));

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8"
        >
            <header className="max-w-3xl">
                <Badge variant="warning">
                    <WarningIcon aria-hidden="true" />
                    {t("common.draftTitle")}
                </Badge>
                <h1 className="type-h1 mt-3 text-balance">{title}</h1>
                <p className="type-body-lg mt-3 text-muted-foreground">
                    {intro}
                </p>
                <p className="type-small mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                    <span>
                        {t("common.versionLabel")}:{" "}
                        <code className="type-code text-foreground">
                            {LEGAL_VERSION}
                        </code>
                    </span>
                    <span>
                        {t("common.lastUpdatedLabel")}:{" "}
                        <time dateTime={LEGAL_LAST_UPDATED}>
                            {formatDate(LEGAL_LAST_UPDATED, language)}
                        </time>
                    </span>
                </p>
                <Alert variant="warning" role="note" className="mt-6">
                    <WarningIcon aria-hidden="true" />
                    <AlertTitle>{t("common.draftNotice")}</AlertTitle>
                    <AlertDescription>
                        <p>{t("common.placeholderNote")}</p>
                        {language === "en" ? null : (
                            <p>{t("common.englishAuthoritative")}</p>
                        )}
                    </AlertDescription>
                </Alert>
                <Button
                    type="button"
                    variant="outline"
                    className="mt-4 print:hidden"
                    onClick={() => window.print()}
                >
                    {t("common.print")}
                </Button>
            </header>

            <div className="mt-10 grid gap-8 lg:grid-cols-4">
                <div className="lg:col-span-1">
                    <LegalToc items={tocItems} />
                </div>
                <article className="flex flex-col gap-10 lg:col-span-3">
                    {sections.map(({ id, key }) => (
                        <LegalSection
                            key={id}
                            id={id}
                            docKey={docKey}
                            sectionKey={key}
                            extra={extras[id] ?? null}
                        />
                    ))}
                    <Alert variant="info" role="note">
                        <InfoIcon aria-hidden="true" />
                        <AlertTitle>{t("common.disclaimerTitle")}</AlertTitle>
                        <AlertDescription>
                            {t("common.disclaimer")}
                        </AlertDescription>
                    </Alert>
                    {related ? (
                        <p className="type-body print:hidden">
                            {t("common.related")}:{" "}
                            <Link
                                to={related.to}
                                className="rounded-sm text-primary-text underline underline-offset-4"
                            >
                                {related.label}
                            </Link>
                        </p>
                    ) : null}
                </article>
            </div>
        </main>
    );
}
