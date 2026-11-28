import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/*
 * shadcn chart base. Recharts is approved only through this file: feature code imports `ChartContainer` and the
 * re-exported primitives from here, never from "recharts". Series colours come from the `--chart-1` to `--chart-5` tokens.
 */

const ChartContext = React.createContext(null);

export function useChart() {
    const context = React.useContext(ChartContext);
    if (!context) throw new Error("useChart must be used inside <ChartContainer />");
    return context;
}

/** `config`: `{ [seriesKey]: { label, color } }` where `color` is a CSS token such as `var(--chart-1)`. */
function ChartContainer({ id, className, children, config, ...props }) {
    const uniqueId = React.useId();
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
    const style = {};
    for (const [key, item] of Object.entries(config)) {
        if (item.color) style[`--color-${key}`] = item.color;
    }
    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                style={style}
                className={cn(
                    "flex aspect-square w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-polar-angle-axis-tick_text]:fill-muted-foreground [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
                    className
                )}
                {...props}
            >
                <RechartsPrimitive.ResponsiveContainer
                    initialDimension={{ width: 320, height: 320 }}
                >
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartLegend = RechartsPrimitive.Legend;

function ChartTooltipContent({ active, payload, label }) {
    const { config } = useChart();
    if (!active || !payload?.length) return null;
    return (
        <div className="grid min-w-32 gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
            {label ? <div className="font-medium">{label}</div> : null}
            {payload.map((item) => (
                <div key={item.dataKey} className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: `var(--color-${item.dataKey})` }}
                    />
                    <span className="text-muted-foreground">
                        {config[item.dataKey]?.label ?? item.name}
                    </span>
                    <span className="ml-auto font-mono font-medium tabular-nums">
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

function ChartLegendContent({ payload }) {
    const { config } = useChart();
    if (!payload?.length) return null;
    return (
        <ul className="flex flex-wrap items-center justify-center gap-4 pt-3">
            {payload.map((item) => (
                <li key={item.dataKey} className="flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: `var(--color-${item.dataKey})` }}
                    />
                    {config[item.dataKey]?.label ?? item.value}
                </li>
            ))}
        </ul>
    );
}

const {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
} = RechartsPrimitive;

export {
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
};
