import { CheckCircleIcon, RefreshIcon } from "@/components/icons";
import { ValueTick } from "@/components/motion/ValueTick";
import { Badge } from "@/components/ui/badge";
import { MockLevelBar } from "@/features/marketing/components/MockLevelBar";
import { MockWindow } from "@/features/marketing/components/MockWindow";
import {
    MOCK_COMPETENCIES,
    levelOf,
    readiness,
} from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

const PRIVACY = MOCK_COMPETENCIES.find((item) => item.id === "privacy");
const EVENTS = ["quiz", "completed", "endorsed"];
const DELAY = ["delay-0", "delay-200", "delay-500"];

/** Evidence step: new evidence arrives, the level and the readiness figure tick up and the bar moves. */
export function HowVisualEvidence({ t, active }) {
    const level = levelOf(PRIVACY, active);
    return (
        <MockWindow
            title={t("how.visual.window.evidence")}
            demoLabel={t("how.visual.demo")}
        >
            <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                    <p className="type-h4">
                        {t("how.visual.evidence.timelineTitle")}
                    </p>
                    <ul className="flex flex-col gap-2">
                        {EVENTS.map((event, index) => (
                            <li
                                key={event}
                                className={cn(
                                    "flex items-start gap-2 rounded-md border border-border p-3 transition-opacity duration-500 motion-reduce:transition-none",
                                    DELAY[index],
                                    active ? "opacity-100" : "opacity-30"
                                )}
                            >
                                <CheckCircleIcon
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-success"
                                />
                                <span className="type-small">
                                    {t(`how.visual.evidence.${event}`)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                        <div className="flex items-baseline justify-between">
                            <span className="type-small font-medium">
                                {t("how.visual.evidence.levelTitle")}
                            </span>
                            <span className="type-caption text-muted-foreground">
                                {t("how.visual.evidence.level")}{" "}
                                <ValueTick
                                    className="type-h4 text-foreground"
                                    value={level}
                                    initial={PRIVACY.current}
                                />
                                {" / "}
                                {PRIVACY.required}{" "}
                                {t("how.visual.evidence.needed")}
                            </span>
                        </div>
                        <MockLevelBar
                            level={level}
                            required={PRIVACY.required}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                        <span className="type-small">
                            {t("how.visual.evidence.readiness")}
                        </span>
                        <ValueTick
                            className="type-h4"
                            value={readiness(MOCK_COMPETENCIES, active)}
                            initial={readiness()}
                            suffix="%"
                        />
                    </div>
                    <div
                        className={cn(
                            "flex items-start gap-2 rounded-md border border-info-border bg-info-subtle p-3 text-info-subtle-foreground transition-opacity duration-500 delay-700 motion-reduce:transition-none",
                            active ? "opacity-100" : "opacity-30"
                        )}
                    >
                        <RefreshIcon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <div>
                            <p className="type-small font-medium">
                                {t("how.visual.evidence.refreshed")}
                            </p>
                            <p className="type-caption">
                                {t("how.visual.evidence.refreshedBody")}
                            </p>
                        </div>
                        <Badge variant="info" className="ml-auto">
                            {t("hero.mock.simulated")}
                        </Badge>
                    </div>
                </div>
            </div>
        </MockWindow>
    );
}
