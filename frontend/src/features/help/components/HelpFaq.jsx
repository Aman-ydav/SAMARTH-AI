import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { PATHS } from "@/lib/paths";

/** Frequently asked questions, the same for every role (the list is an array key, FE-83), plus the two legal pages. */
export function HelpFaq() {
    const { t } = useTranslation(["help", "common"]);
    const headingId = useId();
    const items = t("help:faq.items", { returnObjects: true });

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4">
            <h2 id={headingId} className="type-h2 text-foreground">
                {t("help:faq.title")}
            </h2>
            <Accordion type="single" collapsible className="max-w-3xl">
                {Array.isArray(items)
                    ? items.map((item) => (
                          <AccordionItem
                              key={item.question}
                              value={item.question}
                          >
                              <AccordionTrigger>
                                  {item.question}
                              </AccordionTrigger>
                              <AccordionContent className="type-body text-muted-foreground">
                                  {item.answer}
                              </AccordionContent>
                          </AccordionItem>
                      ))
                    : null}
            </Accordion>
            <p className="type-small flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                <span>{t("help:faq.legal")}</span>
                <Link
                    to={PATHS.terms}
                    className="text-primary-text underline-offset-4 hover:underline"
                >
                    {t("common:pages.terms")}
                </Link>
                <Link
                    to={PATHS.privacy}
                    className="text-primary-text underline-offset-4 hover:underline"
                >
                    {t("common:pages.privacy")}
                </Link>
            </p>
        </section>
    );
}
