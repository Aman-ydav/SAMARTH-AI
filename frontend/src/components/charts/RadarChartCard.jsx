import { useTranslation } from "react-i18next";
import { ChartErrorBoundary } from "@/components/charts/ChartErrorBoundary";
import { ErrorIcon, RadarIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_LEVEL = 5;
const clampLevel = (value) =>
    Math.min(MAX_LEVEL, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * Radar of current against required level (0 to 5) per axis. `axes`: `[{ label, current, required }]`.
 * States: `loading`, `error` (with `onRetry`), empty (no axes) and success. Colours are the chart-1 and chart-2 tokens only.
 */
export function RadarChartCard({
    axes = [],
    title,
    description,
    loading = false,
    error = null,
    onRetry,
}) {
    const { t } = useTranslation("common");
    const heading = title ?? t("charts.radar.title");
    const data = axes.map((axis) => ({
        label: axis.label,
        current: clampLevel(axis.current),
        required: clampLevel(axis.required),
    }));
    const config = {
        current: { label: t("charts.radar.current"), color: "var(--chart-1)" },
        required: { label: t("charts.radar.required"), color: "var(--chart-2)" },
    };
    const summary = t("charts.radar.aria", { count: data.length });

    const errorState = (
        <Alert variant="destructive" role="alert">
            <ErrorIcon aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-2">
                <p>{t("charts.radar.error")}</p>
                {onRetry ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                    >
                        {t("retry")}
                    </Button>
                ) : null}
            </AlertDescription>
        </Alert>
    );

    let body;
    if (loading) {
        body = (
            <div aria-busy="true" aria-label={t("loading")}>
                <Skeleton className="mx-auto aspect-square w-full max-w-sm" />
            </div>
        );
    } else if (error) {
        body = errorState;
    } else if (data.length === 0) {
        body = (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
                <RadarIcon
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                />
                <p className="text-muted-foreground">
                    {t("charts.radar.empty")}
                </p>
            </div>
        );
    } else {
        body = (
            <ChartErrorBoundary fallback={errorState}>
                <div role="img" aria-label={summary}>
                    <ChartContainer
                        config={config}
                        className="mx-auto max-h-96 max-w-md"
                    >
                        <RadarChart data={data}>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <PolarGrid className="stroke-border" />
                            <PolarAngleAxis dataKey="label" />
                            <PolarRadiusAxis
                                domain={[0, MAX_LEVEL]}
                                tickCount={MAX_LEVEL + 1}
                                axisLine={false}
                            />
                            <Radar
                                dataKey="required"
                                stroke="var(--color-required)"
                                strokeDasharray="4 3"
                                fill="var(--color-required)"
                                fillOpacity={0.1}
                                isAnimationActive={false}
                            />
                            <Radar
                                dataKey="current"
                                stroke="var(--color-current)"
                                fill="var(--color-current)"
                                fillOpacity={0.3}
                                isAnimationActive={false}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                        </RadarChart>
                    </ChartContainer>
                </div>
                <table className="sr-only">
                    <caption>{summary}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t("charts.radar.axis")}</th>
                            <th scope="col">{t("charts.radar.current")}</th>
                            <th scope="col">{t("charts.radar.required")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.label}>
                                <th scope="row">{row.label}</th>
                                <td>{row.current}</td>
                                <td>{row.required}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ChartErrorBoundary>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{heading}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
            </CardHeader>
            <CardContent>{body}</CardContent>
        </Card>
    );
}
