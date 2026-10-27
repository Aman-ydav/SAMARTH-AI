import { useTranslation } from "react-i18next";
import { ScrollPathLine } from "@/components/motion/ScrollPathLine";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import { STORY_STOPS } from "@/features/marketing/data/aboutContent";

function StoryStop({ stop, index, t }) {
    return (
        <div className="max-w-prose">
            <p className="type-overline text-primary-text">
                {t("story.stopLabel", { number: index + 1 })}
            </p>
            <h3 className="type-h3 mt-1 text-foreground">{stop.title}</h3>
            <p className="type-body-lg mt-2 text-muted-foreground">
                {stop.body}
            </p>
        </div>
    );
}

/**
 * Why we built it (ANIM-51, second): the problem behind SIH26101 told as a timeline whose line is drawn by the
 * scroll, from "scattered training" to "a measured path" (PATH_DRAW, ANIM-45). The problem statement facts sit beside it.
 */
export function AboutStorySection() {
    const { t } = useTranslation("about");
    const stops = t("story.stops", { returnObjects: true });
    const facts = t("story.facts", { returnObjects: true });
    const items = STORY_STOPS.flatMap(({ id }, index) => {
        const stop = Array.isArray(stops) ? stops[index] : null;
        return stop ? [{ id, ...stop }] : [];
    });

    return (
        <AboutSectionShell title={t("story.title")} intro={t("story.intro")}>
            <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
                <div className="lg:col-span-2">
                    <ScrollPathLine
                        items={items}
                        label={t("story.timelineLabel")}
                        renderItem={(stop, index) => (
                            <StoryStop stop={stop} index={index} t={t} />
                        )}
                    />
                </div>
                <aside
                    aria-labelledby="about-story-facts"
                    className="content-start self-start rounded-lg border border-border bg-card p-6"
                >
                    <h3 id="about-story-facts" className="type-h4">
                        {t("story.factsTitle")}
                    </h3>
                    <dl className="mt-4 grid gap-4">
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
                </aside>
            </div>
        </AboutSectionShell>
    );
}
