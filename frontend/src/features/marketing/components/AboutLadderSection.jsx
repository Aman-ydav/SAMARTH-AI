import { useTranslation } from "react-i18next";
import { StickyScrollStory } from "@/components/motion/StickyScrollStory";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";
import { LADDER_LEVELS } from "@/features/marketing/data/aboutContent";
import { cn } from "@/lib/utils";

/* One column per level, rising by 2.5rem steps; filled up to the active level. Static class names for Tailwind. */
const COLUMN_HEIGHT = ["h-10", "h-20", "h-30", "h-40", "h-50", "h-60"];

function LadderVisual({ level }) {
    return (
        <div className="flex h-80 items-end justify-center gap-3 rounded-lg border border-border bg-card p-6">
            {LADDER_LEVELS.map((value) => (
                <div
                    key={value}
                    className={cn(
                        "flex w-10 items-start justify-center rounded-sm pt-1 font-mono type-small tabular-nums",
                        COLUMN_HEIGHT[value],
                        value <= level
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {value}
                </div>
            ))}
        </div>
    );
}

/** Competency ladder, levels 0 to 5 (ANIM-51, third; STICKY_STORY per the placement matrix). */
export function AboutLadderSection() {
    const { t } = useTranslation("about");
    const levels = t("ladder.levels", { returnObjects: true });
    const steps = (Array.isArray(levels) ? levels : []).map((level, index) => ({
        id: `level-${index}`,
        title: t("ladder.levelTitle", { level: index, name: level.name }),
        body: level.summary,
    }));

    return (
        <AboutSectionShell title={t("ladder.title")} intro={t("ladder.intro")}>
            <StickyScrollStory
                steps={steps}
                renderVisual={(_step, index) => <LadderVisual level={index} />}
            />
        </AboutSectionShell>
    );
}
