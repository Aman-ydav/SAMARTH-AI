import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatNumber } from "@/lib/format";

const MAX_LEVEL = 5;

/** One competency: level bar (0 to 5), confidence, last assessed date and the evidence behind the level. */
export function CompetencyCard({ competency }) {
    const { t, i18n } = useTranslation("common");
    const language = i18n.language;
    const level = Math.min(MAX_LEVEL, Math.max(0, competency.currentLevel ?? 0));
    const confidence = Math.round((competency.confidenceScore ?? 0) * 100);
    const evidence = competency.evidence ?? [];
    const titleId = `competency-${competency.competencyId}`;

    return (
        <Card aria-labelledby={titleId}>
            <CardHeader>
                <CardTitle id={titleId} className="type-h4">
                    {competency.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    {competency.domain}
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                        <span>{t("competencies.level")}</span>
                        <span className="font-medium">
                            {t("competencies.levelValue", { level })}
                        </span>
                    </div>
                    <Progress
                        value={(level / MAX_LEVEL) * 100}
                        aria-label={t("competencies.levelAria", {
                            name: competency.name,
                            level,
                        })}
                    />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <dt className="text-muted-foreground">
                            {t("competencies.confidence")}
                        </dt>
                        <dd className="font-medium">
                            {formatNumber(confidence, language)}%
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">
                            {t("competencies.lastAssessed")}
                        </dt>
                        <dd className="font-medium">
                            {competency.lastAssessedAt
                                ? formatDate(competency.lastAssessedAt, language)
                                : t("competencies.never")}
                        </dd>
                    </div>
                </dl>
                <section className="flex flex-col gap-1.5">
                    <h4 className="text-sm font-medium text-foreground">
                        {t("competencies.evidence")}
                    </h4>
                    {evidence.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("competencies.noEvidence")}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1 text-sm">
                            {evidence.map((entry, index) => (
                                <li
                                    key={`${entry.type}-${entry.earnedAt}-${index}`}
                                    className="flex flex-wrap justify-between gap-x-3"
                                >
                                    <span>
                                        {t(`competencies.evidenceType.${entry.type}`, {
                                            defaultValue: entry.type,
                                        })}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {t("competencies.evidenceScore", {
                                            score: formatNumber(
                                                entry.score ?? 0,
                                                language
                                            ),
                                        })}
                                        {entry.earnedAt
                                            ? ` · ${formatDate(entry.earnedAt, language)}`
                                            : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </CardContent>
        </Card>
    );
}
