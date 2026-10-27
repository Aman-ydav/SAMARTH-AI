import { useTranslation } from "react-i18next";
import {
    DashboardPanelIcon,
    LightbulbIcon,
    RadarIcon,
    RouteIcon,
    ShieldIcon,
} from "@/components/icons";
import { StackedCards } from "@/components/motion/StackedCards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import {
    BUILD_CHAPTERS,
    STATUS_BADGE_VARIANT,
} from "@/features/marketing/data/aboutContent";

const CHAPTER_ICON = {
    idea: LightbulbIcon,
    framework: RadarIcon,
    backend: ShieldIcon,
    interface: DashboardPanelIcon,
    next: RouteIcon,
};

function ChapterCard({ chapter, index, t }) {
    const Icon = CHAPTER_ICON[chapter.id];
    const statusLabel = {
        done: t("roadmap.status.done"),
        inProgress: t("roadmap.status.inProgress"),
        planned: t("roadmap.status.planned"),
    };
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"
                        >
                            <Icon className="size-5" />
                        </span>
                        <span className="type-small font-mono text-muted-foreground">
                            {t("how.chapterLabel", { number: index + 1 })}
                        </span>
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[chapter.status]}>
                        <span className="sr-only">
                            {t("how.statusLabel")}:{" "}
                        </span>
                        {statusLabel[chapter.status]}
                    </Badge>
                </div>
                <CardTitle>
                    <h3 className="type-h3">{chapter.title}</h3>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="type-body text-muted-foreground">
                    {chapter.body}
                </p>
                <ul className="flex flex-wrap gap-2">
                    {chapter.points.map((point) => (
                        <li key={point}>
                            <Badge variant="secondary">{point}</Badge>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

/**
 * How we built it (ANIM-51, fifth): five chapters, idea to what is next, stacked as pinned cards (STACK_CARDS,
 * ANIM-46). Each chapter carries an honest status; the framework, backend and interface chapters are still in progress.
 */
export function AboutHowSection() {
    const { t } = useTranslation("about");
    const chapters = t("how.chapters", { returnObjects: true });
    const items = BUILD_CHAPTERS.flatMap(({ id, status }, index) => {
        const chapter = Array.isArray(chapters) ? chapters[index] : null;
        return chapter
            ? [{ id, status, ...chapter, points: chapter.points ?? [] }]
            : [];
    });

    return (
        <AboutSectionShell title={t("how.title")} intro={t("how.intro")}>
            <StackedCards
                items={items}
                label={t("how.listLabel")}
                renderItem={(chapter, index) => (
                    <ChapterCard chapter={chapter} index={index} t={t} />
                )}
            />
        </AboutSectionShell>
    );
}
