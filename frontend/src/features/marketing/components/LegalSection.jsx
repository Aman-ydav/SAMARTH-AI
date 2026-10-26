import { useTranslation } from "react-i18next";
import { LEGAL_PLACEHOLDERS } from "@/features/marketing/data/legalMeta";
import { resolveLanguage } from "@/lib/format";

const asList = (value) => (Array.isArray(value) ? value : []);

/**
 * One titled section of the Privacy Policy or Terms, addressed by its stable anchor `id` (docs/23 section 5).
 * Copy is read from `legal:<docKey>.sections.<sectionKey>.{title,paragraphs,items,after}`; keys are built from the
 * controlled data in `data/legalMeta.js` only. A block with no Hindi text falls back to English and is marked
 * `lang="en"` so assistive technology reads it correctly. `extra` (for example the cookie table) renders after
 * the paragraphs and items.
 */
export function LegalSection({ id, docKey, sectionKey, extra = null }) {
    const { t, i18n } = useTranslation("legal");
    const language = resolveLanguage(i18n.language);
    const base = `${docKey}.sections.${sectionKey}`;
    const read = (field) =>
        asList(
            t(`${base}.${field}`, {
                returnObjects: true,
                defaultValue: [],
                ...LEGAL_PLACEHOLDERS,
            })
        );
    const langOf = (field) =>
        language !== "en" &&
        i18n.getResource(language, "legal", `${base}.${field}`) === undefined
            ? "en"
            : undefined;

    const paragraphs = read("paragraphs");
    const items = read("items");
    const after = read("after");

    return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
            <h2 id={id} className="type-h2 scroll-mt-24" lang={langOf("title")}>
                {t(`${base}.title`)}
            </h2>
            {paragraphs.map((text) => (
                <p
                    key={text}
                    className="type-body max-w-prose"
                    lang={langOf("paragraphs")}
                >
                    {text}
                </p>
            ))}
            {items.length > 0 ? (
                <ul
                    className="type-body max-w-prose list-disc space-y-2 ps-5"
                    lang={langOf("items")}
                >
                    {items.map((text) => (
                        <li key={text}>{text}</li>
                    ))}
                </ul>
            ) : null}
            {extra}
            {after.map((text) => (
                <p
                    key={text}
                    className="type-body max-w-prose"
                    lang={langOf("after")}
                >
                    {text}
                </p>
            ))}
        </section>
    );
}
