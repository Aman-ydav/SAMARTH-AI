import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { RadarChartCard } from "@/components/charts/RadarChartCard";
import { ClockIcon, RadarIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkillGapsCard } from "@/features/dashboard/components/SkillGapsCard";
import {
    fetchDashboard,
    selectDashboard,
    topGaps,
} from "@/features/dashboard/slice/dashboardSlice";
import { STATUS } from "@/lib/asyncState";
import { PATHS } from "@/lib/paths";

/** Learner overview: radar of current against required level, top five gaps, planned learning hours. */
export function LearnerOverview() {
    const { t } = useTranslation("nav");
    const dispatch = useAppDispatch();
    const { status, analysis, hours, error } = useAppSelector(selectDashboard);
    const loading = status === STATUS.IDLE || status === STATUS.LOADING;
    const gaps = useMemo(() => topGaps(analysis, 5), [analysis]);
    const axes = useMemo(
        () =>
            (analysis?.gaps ?? []).map((gap) => ({
                label: gap.name,
                current: gap.currentLevel,
                required: gap.requiredLevel,
            })),
        [analysis]
    );
    const retry = () => dispatch(fetchDashboard({ force: true }));

    useEffect(() => {
        dispatch(fetchDashboard());
    }, [dispatch]);

    if (status === STATUS.SUCCEEDED && axes.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                    <RadarIcon
                        className="size-6 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <p className="font-medium text-card-foreground">
                        {t("dashboard.overview.emptyTitle")}
                    </p>
                    <p className="max-w-prose text-muted-foreground">
                        {t("dashboard.overview.emptyBody")}
                    </p>
                    <Button asChild>
                        <Link to={PATHS.settingsProfile}>
                            {t("dashboard.overview.action")}
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <RadarChartCard
                axes={axes}
                loading={loading}
                error={status === STATUS.FAILED ? error : null}
                onRetry={retry}
                description={
                    analysis
                        ? t("dashboard.readiness", {
                              score: analysis.readinessScore,
                          })
                        : undefined
                }
            />
            <div className="flex flex-col gap-4">
                {status === STATUS.SUCCEEDED && (
                    <SkillGapsCard gaps={gaps} />
                )}
                {status === STATUS.SUCCEEDED && (
                    <Card>
                        <CardContent className="flex items-center gap-3">
                            <ClockIcon
                                className="size-5 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">
                                    {t("dashboard.hours.label")}
                                </span>
                                <span className="font-medium text-foreground">
                                    {hours === null
                                        ? t("dashboard.hours.none")
                                        : t("dashboard.hours.value", {
                                              count: hours,
                                          })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
