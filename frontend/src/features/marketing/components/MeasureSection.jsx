import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { ScrollMeters } from "@/components/motion/ScrollMeters";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionShell } from "@/features/marketing/components/SectionShell";
import { MOCK_COMPETENCIES } from "@/features/marketing/data/heroMock";
import { MEASURE_ROW_IDS } from "@/features/marketing/data/landingContent";

const POINTS = ["measured", "gap"];

/**
 * Story beats 1 and 2 (SCROLL_METERS): skills are invisible until measured. The bars fill to a level as you scroll,
 * then the role's requirement and the gap light up. Rows come from the shared demo fixture.
 */
export function MeasureSection() {
    const { t } = useTranslation("landing");
    const rows = MEASURE_ROW_IDS.map((id) => {
        const item = MOCK_COMPETENCIES.find((entry) => entry.id === id);
        return {
            id,
            label: t(`hero.mock.competencies.${id}`),
            value: item.current,
            required: item.required,
        };
    });

    return (
        <SectionShell
            id="measure"
            title={t("measure.title")}
            intro={t("measure.sub")}
        >
            <div className="mt-10 grid items-start gap-10 lg:grid-cols-5">
                <ol className="flex flex-col gap-6 lg:col-span-2">
                    {POINTS.map((point, index) => (
                        <Reveal
                            as="li"
                            key={point}
                            delay={index * 0.08}
                            className="flex gap-4"
                        >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-mono type-small text-accent-foreground">
                                {index + 1}
                            </span>
                            <div>
                                <h3 className="type-h4 text-foreground">
                                    {t(`measure.points.${point}.title`)}
                                </h3>
                                <p className="mt-1 type-body text-muted-foreground">
                                    {t(`measure.points.${point}.body`)}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </ol>
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>{t("measure.card.title")}</CardTitle>
                        <Badge variant="info">{t("measure.card.demo")}</Badge>
                    </CardHeader>
                    <div className="flex flex-col gap-4 px-(--card-spacing)">
                        <ScrollMeters
                            rows={rows}
                            unknown={t("measure.card.unknown")}
                            gapLabel={(value) =>
                                t("measure.card.gap", { value })
                            }
                        />
                        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 type-caption text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full bg-primary" />
                                {t("measure.card.current")}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full bg-warning" />
                                {t("measure.card.required")}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </SectionShell>
    );
}
