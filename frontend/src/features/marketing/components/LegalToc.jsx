import { useTranslation } from "react-i18next";
import { Link } from "react-router";

/**
 * Table of contents for a legal document: one in-page link per section (stable ids from docs/23 section 5).
 * `items` are `{ id, title }`. Sticky from `lg`, hidden when printing.
 */
export function LegalToc({ items }) {
    const { t } = useTranslation("legal");
    return (
        <nav
            aria-labelledby="legal-toc-title"
            className="rounded-lg border border-border bg-card p-4 lg:sticky lg:top-24 lg:self-start print:hidden"
        >
            <h2 id="legal-toc-title" className="type-h4">
                {t("common.tocTitle")}
            </h2>
            <ol className="type-small mt-3 flex flex-col gap-1">
                {items.map(({ id, title }) => (
                    <li key={id}>
                        <Link
                            to={{ hash: `#${id}` }}
                            className="block rounded-sm py-1 text-muted-foreground hover:text-foreground hover:underline"
                        >
                            {title}
                        </Link>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
