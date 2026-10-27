import { useTranslation } from "react-i18next";
import { ScrollPathLine } from "@/components/motion/ScrollPathLine";
import { Badge } from "@/components/ui/badge";
import { JourneyLevel } from "@/features/marketing/components/JourneyLevel";
import { SectionShell } from "@/features/marketing/components/SectionShell";
import { JOURNEY_STOPS } from "@/features/marketing/data/landingContent";

function Stop({ stop, t }) {
    return (
        <div className="max-w-xl">
            <h3 className="type-h3 text-foreground">
                {t(`journey.stops.${stop.id}.title`)}
            </h3>
            <p className="mt-1 type-body text-muted-foreground">
                {t(`journey.stops.${stop.id}.body`)}
            </p>
            {stop.source ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                        {t(`hero.mock.sources.${stop.source}`)}
                    </Badge>
                    <Badge variant="secondary">
                        {t("hero.mock.simulated")}
                    </Badge>
                    <span className="font-mono type-caption text-muted-foreground">
                        {t("hero.mock.path.hours", { value: stop.hours })}
                    </span>
                </div>
            ) : null}
            {stop.kind === "quiz" ? <JourneyLevel t={t} /> : null}
        </div>
    );
}

/**
 * Story beats 3 to 5 (PATH_DRAW): a path of courses ordered by the gap they close, with a quiz after the first one
 * that moves a level. The line is drawn by scroll; the sources are simulated and badged as such.
 */
export function JourneySection() {
    const { t } = useTranslation("landing");
    return (
        <SectionShell
            id="journey"
            title={t("journey.title")}
            intro={t("journey.sub")}
        >
            <ScrollPathLine
                className="mt-10"
                label={t("journey.label")}
                items={JOURNEY_STOPS}
                renderItem={(stop) => <Stop stop={stop} t={t} />}
            />
        </SectionShell>
    );
}
