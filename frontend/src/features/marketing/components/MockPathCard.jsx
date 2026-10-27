import { CheckCircleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MOCK_PATH } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

function Item({ item, index, t, view }) {
    const progress = view.powered
        ? view.evidence
            ? item.after
            : item.progress
        : 0;
    const done = view.evidence && item.after === 100;
    return (
        <li className="flex items-start gap-2">
            <span className="relative grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono type-caption text-accent-foreground">
                {index + 1}
                <CheckCircleIcon
                    aria-hidden="true"
                    className={cn(
                        "absolute -inset-px size-6.5 rounded-full bg-card text-success transition-opacity duration-500 motion-reduce:transition-none",
                        done ? "opacity-100" : "opacity-0"
                    )}
                />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate type-small text-card-foreground">
                    {t(`hero.mock.path.items.${item.id}`)}
                </span>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">
                        {t(`hero.mock.sources.${item.source}`)}
                    </Badge>
                    <span className="type-caption text-muted-foreground">
                        {t("hero.mock.path.hours", { value: item.hours })}
                    </span>
                </div>
                <Progress value={progress} className="h-1.5" />
            </div>
        </li>
    );
}

/** Recommended learning path with progress bars and simulated-source badges. */
export function MockPathCard({ t, view }) {
    return (
        <Card className="h-72 gap-2 overflow-clip [--card-spacing:--spacing(3)]">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("hero.mock.path.title")}</CardTitle>
                <Badge variant="secondary">{t("hero.mock.simulated")}</Badge>
            </CardHeader>
            <ol className="flex flex-col gap-2.5 px-3">
                {MOCK_PATH.map((item, index) => (
                    <Item
                        key={item.id}
                        item={item}
                        index={index}
                        t={t}
                        view={view}
                    />
                ))}
            </ol>
        </Card>
    );
}
