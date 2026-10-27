import { ValueTick } from "@/components/motion/ValueTick";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";
import { MOCK_COMPETENCIES, levelOf } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

function Legend({ t }) {
    return (
        <div className="flex items-center gap-3 type-caption text-muted-foreground">
            <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" />
                {t("hero.mock.levels.current")}
            </span>
            <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-warning" />
                {t("hero.mock.levels.required")}
            </span>
        </div>
    );
}

function Row({ item, t, view }) {
    const level = view.powered ? levelOf(item, view.evidence) : 0;
    return (
        <li className="flex h-7 items-center gap-3">
            <span className="w-36 truncate type-small text-card-foreground">
                {t(`hero.mock.competencies.${item.id}`)}
            </span>
            <MockLevelBar
                className="flex-1"
                level={level}
                required={item.required}
                showRequired={view.required}
            />
            <span className="flex w-14 items-baseline justify-end gap-1 type-small">
                <ValueTick value={level} initial={0} />
                <span
                    className={cn(
                        "font-mono text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none",
                        view.required ? "opacity-100" : "opacity-0"
                    )}
                >
                    / {item.required}
                </span>
            </span>
        </li>
    );
}

/** Competency level bars (about eight) with current versus required markers; the privacy bar moves after the quiz. */
export function MockLevelsCard({ t, view }) {
    return (
        <Card className="h-72 gap-2 overflow-clip [--card-spacing:--spacing(3)]">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("hero.mock.levels.title")}</CardTitle>
                <Legend t={t} />
            </CardHeader>
            <ul className="flex flex-col gap-0.5 px-3">
                {MOCK_COMPETENCIES.map((item) => (
                    <Row key={item.id} item={item} t={t} view={view} />
                ))}
            </ul>
        </Card>
    );
}
