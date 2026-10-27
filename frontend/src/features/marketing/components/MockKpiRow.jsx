import {
    BookIcon,
    CheckCircleIcon,
    ClockIcon,
    TargetIcon,
    WarningIcon,
} from "@/components/icons";
import { ValueTick } from "@/components/motion/ValueTick";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    MOCK_COMPETENCIES,
    MOCK_KPIS,
    readiness,
    rankedGaps,
} from "@/features/marketing/data/heroMock";
import { FRAMEWORK_FIGURES } from "@/features/marketing/data/landingContent";
import { cn } from "@/lib/utils";

const FRAMEWORK_TOTAL = FRAMEWORK_FIGURES.find(
    (figure) => figure.id === "competencies"
).value;

function Kpi({ icon: Icon, label, hint, children, extra }) {
    return (
        <Card className="gap-1 overflow-clip [--card-spacing:--spacing(3)]">
            <div className="flex flex-col gap-1 px-3">
                <div className="flex items-center gap-1.5 type-caption text-muted-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="truncate">{label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                    {children}
                    {extra}
                </div>
                <div className="truncate type-caption text-muted-foreground">
                    {hint}
                </div>
            </div>
        </Card>
    );
}

function Delta({ on, value, t }) {
    return (
        <Badge
            variant="success"
            className={cn(
                "transition-opacity duration-500 motion-reduce:transition-none",
                on ? "opacity-100" : "opacity-0"
            )}
        >
            {t("hero.mock.kpi.delta", { value })}
        </Badge>
    );
}

/** Five KPI cards: readiness, competencies assessed, open gaps, learning hours and streak. Numbers tick (VALUE_TICK). */
export function MockKpiRow({ t, view }) {
    const { powered, evidence } = view;
    const shown = (value) => (powered ? value : 0);
    const readinessNow = readiness(MOCK_COMPETENCIES, evidence);
    const gain = readiness(MOCK_COMPETENCIES, true) - readiness();

    return (
        <div className="grid grid-cols-5 gap-4">
            <Kpi
                icon={TargetIcon}
                label={t("hero.mock.kpi.readiness")}
                hint={
                    <Progress value={shown(readinessNow)} className="h-1.5" />
                }
                extra={<Delta on={evidence} value={gain} t={t} />}
            >
                <ValueTick
                    className="type-h3"
                    value={shown(readinessNow)}
                    initial={0}
                    suffix="%"
                />
            </Kpi>
            <Kpi
                icon={CheckCircleIcon}
                label={t("hero.mock.kpi.assessed")}
                hint={t("hero.mock.kpi.assessedOf", { total: FRAMEWORK_TOTAL })}
            >
                <ValueTick
                    className="type-h3"
                    value={shown(MOCK_KPIS.assessed.value)}
                    initial={0}
                />
            </Kpi>
            <Kpi
                icon={WarningIcon}
                label={t("hero.mock.kpi.gaps")}
                hint={t("hero.mock.kpi.gapsHint")}
            >
                <ValueTick
                    className="type-h3"
                    value={shown(
                        rankedGaps(MOCK_COMPETENCIES, evidence).length
                    )}
                    initial={0}
                />
            </Kpi>
            <Kpi
                icon={ClockIcon}
                label={t("hero.mock.kpi.hours")}
                hint={t("hero.mock.kpi.hoursHint")}
            >
                <ValueTick
                    className="type-h3"
                    value={shown(
                        evidence ? MOCK_KPIS.hours.after : MOCK_KPIS.hours.value
                    )}
                    initial={0}
                />
            </Kpi>
            <Kpi
                icon={BookIcon}
                label={t("hero.mock.kpi.streak")}
                hint={t("hero.mock.kpi.streakHint")}
            >
                <ValueTick
                    className="type-h3"
                    value={shown(
                        evidence
                            ? MOCK_KPIS.streak.after
                            : MOCK_KPIS.streak.value
                    )}
                    initial={0}
                />
            </Kpi>
        </div>
    );
}
