import { useTranslation } from "react-i18next";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { InfoIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import { PRODUCT_FACTS } from "@/features/marketing/data/aboutContent";

/** Product facts (COUNT_UP, real figures only) and the prototype disclaimer (ANIM-51 last, ANIM-53). */
export function AboutDisclaimerSection() {
    const { t } = useTranslation("about");
    const labels = t("facts.items", { returnObjects: true });

    return (
        <AboutSectionShell title={t("facts.title")} intro={t("facts.intro")}>
            <Reveal>
                <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                    {PRODUCT_FACTS.map(({ id, value }, index) => (
                        <div
                            key={id}
                            className="flex flex-col-reverse rounded-lg border border-border bg-card p-6"
                        >
                            <dt className="type-small mt-2 text-muted-foreground">
                                {Array.isArray(labels)
                                    ? labels[index]?.label
                                    : null}
                            </dt>
                            <dd className="type-stat">
                                <CountUp value={value} />
                            </dd>
                        </div>
                    ))}
                </dl>
            </Reveal>
            <Alert variant="info" role="note" className="mt-10">
                <InfoIcon aria-hidden="true" />
                <AlertTitle>{t("disclaimer.title")}</AlertTitle>
                <AlertDescription>{t("disclaimer.body")}</AlertDescription>
            </Alert>
        </AboutSectionShell>
    );
}
