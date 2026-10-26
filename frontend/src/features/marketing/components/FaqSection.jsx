import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionShell } from "@/features/marketing/components/SectionShell";

/** FAQ (REVEAL_ON_VIEW + Accordion). The same items feed the FAQPage JSON-LD in LandingSeo. */
export function FaqSection() {
    const { t } = useTranslation("landing");
    const items = t("faq.items", { returnObjects: true });
    const list = Array.isArray(items) ? items : [];

    return (
        <SectionShell
            id="faq"
            title={t("faq.title")}
            containerClassName="max-w-4xl"
        >
            <Reveal className="mt-8">
                <Accordion type="single" collapsible>
                    {list.map((item, index) => (
                        <AccordionItem key={item.q} value={`faq-${index}`}>
                            <AccordionTrigger className="text-base">
                                {item.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-base text-muted-foreground">
                                {item.a}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </Reveal>
        </SectionShell>
    );
}
