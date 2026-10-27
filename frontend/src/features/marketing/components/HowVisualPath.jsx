import { ValueTick } from "@/components/motion/ValueTick";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MockWindow } from "@/features/marketing/components/MockWindow";
import { MOCK_PATH } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

/* Each stop appears a little after the line reaches it (CSS delay classes, transform and opacity only). */
const DELAY = ["delay-0", "delay-300", "delay-500", "delay-700"];
const TOTAL_HOURS = MOCK_PATH.reduce((sum, item) => sum + item.hours, 0);

function Stop({ item, index, last, t, active }) {
    const delay = DELAY[index] ?? "delay-700";
    return (
        <li className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        "absolute top-7 bottom-0 left-3 w-0.5 origin-top bg-primary transition-transform duration-500 motion-reduce:transition-none",
                        delay,
                        active ? "scale-y-100" : "scale-y-0"
                    )}
                />
            ) : null}
            <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono type-caption text-accent-foreground">
                {index + 1}
            </span>
            <div
                className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1.5 transition-opacity duration-500 motion-reduce:transition-none",
                    delay,
                    active ? "opacity-100" : "opacity-30"
                )}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="type-small font-medium">
                        {t(`hero.mock.path.items.${item.id}`)}
                    </span>
                    <Badge variant="outline">
                        {t(`hero.mock.sources.${item.source}`)}
                    </Badge>
                    <Badge variant="secondary">
                        {t("hero.mock.simulated")}
                    </Badge>
                    <span className="ml-auto font-mono type-caption text-muted-foreground">
                        {t("hero.mock.path.hours", { value: item.hours })}
                    </span>
                </div>
                <p className="type-caption text-muted-foreground">
                    {t("how.visual.path.closes", {
                        competency: t(`hero.mock.competencies.${item.closes}`),
                    })}
                </p>
                <Progress
                    value={active ? item.progress : 0}
                    className="h-1.5"
                />
            </div>
        </li>
    );
}

/** Path step: an ordered list whose connecting line is drawn (scaleY) and whose stops appear in sequence when active. */
export function HowVisualPath({ t, active }) {
    return (
        <MockWindow
            title={t("how.visual.window.path")}
            demoLabel={t("how.visual.demo")}
        >
            <div className="flex flex-col gap-4 p-4">
                <ol>
                    {MOCK_PATH.map((item, index) => (
                        <Stop
                            key={item.id}
                            item={item}
                            index={index}
                            last={index === MOCK_PATH.length - 1}
                            t={t}
                            active={active}
                        />
                    ))}
                </ol>
                <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="type-small text-muted-foreground">
                        {t("how.visual.path.total")}
                    </span>
                    <span className="type-h4">
                        <ValueTick
                            value={active ? TOTAL_HOURS : 0}
                            initial={0}
                            suffix=" h"
                        />
                    </span>
                </div>
                <p className="type-caption text-muted-foreground">
                    {t("how.visual.path.note")}
                </p>
            </div>
        </MockWindow>
    );
}
