import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { STAGGER } from "@/lib/motionTokens";

/** Problem statement (TEXT_REVEAL scroll, 60 words or fewer) with three supporting lines. */
export function ProblemSection() {
    const { t } = useTranslation("landing");
    const lines = t("problem.lines", { returnObjects: true });

    return (
        <section aria-labelledby="problem-title" className="py-12 md:py-20">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <h2
                    id="problem-title"
                    className="type-overline text-primary-text uppercase"
                >
                    {t("problem.title")}
                </h2>
                <TextReveal
                    text={t("problem.statement")}
                    className="mt-6 type-h1 text-foreground"
                />
                <ul className="mt-10 grid gap-4 md:grid-cols-3">
                    {(Array.isArray(lines) ? lines : []).map((line, index) => (
                        <Reveal
                            as="li"
                            key={line}
                            delay={index * STAGGER.sibling}
                            className="rounded-lg border border-border bg-card p-5 type-body text-card-foreground"
                        >
                            {line}
                        </Reveal>
                    ))}
                </ul>
            </div>
        </section>
    );
}
