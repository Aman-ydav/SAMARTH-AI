import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { MockAppSidebar } from "@/features/marketing/components/MockAppSidebar";
import { MockAppTopbar } from "@/features/marketing/components/MockAppTopbar";
import { MockFeedCard } from "@/features/marketing/components/MockFeedCard";
import { MockGapsCard } from "@/features/marketing/components/MockGapsCard";
import { MockHighlight } from "@/features/marketing/components/MockHighlight";
import { MockKpiRow } from "@/features/marketing/components/MockKpiRow";
import { MockLevelsCard } from "@/features/marketing/components/MockLevelsCard";
import { MockPathCard } from "@/features/marketing/components/MockPathCard";
import { MockSessionsCard } from "@/features/marketing/components/MockSessionsCard";
import { TOUR_STEPS } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

/** The screen content moves up so the lower cards are in view (translate only), by tour step shift 0 or 1. */
const SHIFT_CLASS = ["translate-y-0", "-translate-y-32"];

/**
 * Full "My competency" page of the demo web app, drawn at the laptop's design size (1120 by 700): sidebar, top bar,
 * greeting, KPI cards, level bars, gap table, learning path, activity and sessions. `step` is the tour step index
 * and `powered` turns the figures on. Every figure is fixture data and the page says so (Demo data badge).
 */
export function MyCompetencyScreen({ step = 0, powered = true }) {
    const { t } = useTranslation("landing");
    const current =
        TOUR_STEPS[Math.min(Math.max(step, 0), TOUR_STEPS.length - 1)];
    const view = {
        powered,
        evidence: current.evidence,
        required: current.required,
    };
    const on = (card) => current.focus.includes(card);

    return (
        <div
            data-slot="mock-screen"
            data-step={current.id}
            className="flex h-full w-full bg-background text-foreground"
        >
            <MockAppSidebar t={t} />
            <div className="flex min-w-0 flex-1 flex-col">
                <MockAppTopbar t={t} />
                <div className="relative min-h-0 flex-1 overflow-clip">
                    <div
                        className={cn(
                            "flex flex-col gap-4 p-4 transition-transform duration-700 ease-out motion-reduce:transition-none",
                            SHIFT_CLASS[current.shift]
                        )}
                    >
                        <div className="flex h-10 items-center justify-between">
                            <div>
                                <p className="type-h3 text-foreground">
                                    {t("hero.mock.app.greeting")}
                                </p>
                                <p className="type-caption text-muted-foreground">
                                    {t("hero.mock.app.persona")}
                                </p>
                            </div>
                            <Badge variant="info">
                                {t("hero.mock.app.demo")}
                            </Badge>
                        </div>
                        <MockHighlight on={on("kpis")}>
                            <MockKpiRow t={t} view={view} />
                        </MockHighlight>
                        <div className="grid grid-cols-5 gap-4">
                            <MockHighlight
                                on={on("levels")}
                                className="col-span-3"
                            >
                                <MockLevelsCard t={t} view={view} />
                            </MockHighlight>
                            <MockHighlight
                                on={on("gaps")}
                                className="col-span-2"
                            >
                                <MockGapsCard t={t} view={view} />
                            </MockHighlight>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <MockHighlight on={on("path")}>
                                <MockPathCard t={t} view={view} />
                            </MockHighlight>
                            <MockHighlight on={on("feed")}>
                                <MockFeedCard t={t} view={view} />
                            </MockHighlight>
                            <MockSessionsCard t={t} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
