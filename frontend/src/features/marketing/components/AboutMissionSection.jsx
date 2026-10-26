import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";

/** Mission statement (word-by-word on scroll) and the problem statement SIH26101 (ANIM-51, second). */
export function AboutMissionSection() {
    const { t } = useTranslation("about");
    const missionId = useId();
    const problemId = useId();
    const paragraphs = t("problem.body", { returnObjects: true });
    const facts = t("problem.facts", { returnObjects: true });

    return (
        <>
            <section
                aria-labelledby={missionId}
                className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 md:py-20 lg:px-8"
            >
                <h2 id={missionId} className="type-overline text-primary-text">
                    {t("mission.title")}
                </h2>
                <TextReveal
                    text={t("mission.statement")}
                    className="type-display mt-4 text-balance"
                />
            </section>
            <section
                aria-labelledby={problemId}
                className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 md:pb-20 lg:px-8"
            >
                <Reveal className="grid gap-8 lg:grid-cols-2">
                    <div>
                        <h2 id={problemId} className="type-h2 text-balance">
                            {t("problem.title")}
                        </h2>
                        <div className="type-body-lg mt-4 flex max-w-prose flex-col gap-4 text-muted-foreground">
                            {Array.isArray(paragraphs)
                                ? paragraphs.map((text) => (
                                      <p key={text}>{text}</p>
                                  ))
                                : null}
                        </div>
                    </div>
                    <dl className="grid content-start gap-4 rounded-lg border border-border bg-card p-6">
                        {Array.isArray(facts)
                            ? facts.map((fact) => (
                                  <div key={fact.label}>
                                      <dt className="type-caption text-muted-foreground">
                                          {fact.label}
                                      </dt>
                                      <dd className="type-stat mt-1">
                                          {fact.value}
                                      </dd>
                                  </div>
                              ))
                            : null}
                    </dl>
                </Reveal>
            </section>
        </>
    );
}
