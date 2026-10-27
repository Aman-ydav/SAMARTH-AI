import { useRef } from "react";
import {
    motion,
    useMotionValueEvent,
    useScroll,
    useTransform,
} from "motion/react";
import { useTranslation } from "react-i18next";
import { useMotionTier } from "@/hooks/useMotionTier";
import { formatNumber } from "@/lib/format";
import { MeterTrack } from "@/components/motion/MeterTrack";
import { METERS } from "@/lib/motionTokens";
import { cn } from "@/lib/utils";

const MAX_ROWS = 8;
const { fillFrom, fillStep, fillSpan, gapFrom, gapTo, seenAt } = METERS;

function Row({ row, max, formatValue, gapLabel, number, track, gap }) {
    const missing = row.required - row.value;
    return (
        <li
            className="flex items-center gap-3"
            style={{ "--level": row.value / max }}
        >
            <span className="w-36 truncate type-small text-card-foreground">
                {row.label}
            </span>
            {track}
            <span
                aria-hidden="true"
                className="w-6 text-right font-mono type-small tabular-nums"
            >
                {number}
            </span>
            <span aria-hidden="true" className="w-16">
                {gap}
            </span>
            <span className="sr-only">
                {formatValue(row.value)} / {formatValue(row.required)}{" "}
                {missing > 0 ? gapLabel(missing) : ""}
            </span>
        </li>
    );
}

function DrivenRow({
    row,
    index,
    max,
    progress,
    unknown,
    formatValue,
    gapLabel,
}) {
    const start = fillFrom + index * fillStep;
    const fill = useTransform(progress, [start, start + fillSpan], [0, 1]);
    const scaleX = useTransform(fill, (value) => value * (row.value / max));
    const gapOpacity = useTransform(progress, [gapFrom, gapTo], [0, 1]);
    const numberRef = useRef(null);
    useMotionValueEvent(fill, "change", (latest) => {
        if (numberRef.current)
            numberRef.current.textContent =
                latest <= seenAt
                    ? unknown
                    : formatValue(Math.round(latest * row.value));
    });
    const gap = row.required - row.value;
    return (
        <Row
            row={row}
            max={max}
            formatValue={formatValue}
            gapLabel={gapLabel}
            number={<span ref={numberRef}>{unknown}</span>}
            track={
                <MeterTrack
                    Animated={motion.span}
                    required={row.required}
                    max={max}
                    fill={scaleX}
                    gapOpacity={gapOpacity}
                />
            }
            gap={
                gap > 0 ? (
                    <motion.span
                        style={{ opacity: gapOpacity }}
                        className="type-caption text-warning-subtle-foreground"
                    >
                        {gapLabel(gap)}
                    </motion.span>
                ) : null
            }
        />
    );
}

function StaticRow({ row, max, formatValue, gapLabel }) {
    const gap = row.required - row.value;
    return (
        <Row
            row={row}
            max={max}
            formatValue={formatValue}
            gapLabel={gapLabel}
            number={formatValue(row.value)}
            track={<MeterTrack required={row.required} max={max} />}
            gap={
                gap > 0 ? (
                    <span className="type-caption text-warning-subtle-foreground">
                        {gapLabel(gap)}
                    </span>
                ) : null
            }
        />
    );
}

function DrivenMeters({ rows, className, ...props }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 85%", "end 45%"],
    });
    return (
        <ul ref={ref} className={cn("flex flex-col gap-3", className)}>
            {rows.map((row, index) => (
                <DrivenRow
                    key={row.id}
                    row={row}
                    index={index}
                    progress={scrollYProgress}
                    {...props}
                />
            ))}
        </ul>
    );
}

function StaticMeters({ rows, className, ...props }) {
    return (
        <ul className={cn("flex flex-col gap-3", className)}>
            {rows.map((row) => (
                <StaticRow key={row.id} row={row} {...props} />
            ))}
        </ul>
    );
}

/**
 * Meters filled by scroll progress (SCROLL_METERS, ANIM-47): `unknown` first, then each bar fills (`scaleX`) while its
 * number counts up, then the required marker and gap light up (`opacity`). `rows`: `[{ id, label, value, required }]`
 * (8 at most); `gapLabel(gap)` returns the gap text. Final values stay in the DOM. Lite and reduced tiers show the end state.
 */
export function ScrollMeters({
    rows,
    max = 5,
    unknown = "?",
    gapLabel,
    className,
}) {
    const tier = useMotionTier();
    const { i18n } = useTranslation();
    if (!rows?.length) return null;
    const formatValue = (value) => formatNumber(value, i18n.language);
    const Meters = tier === "full" ? DrivenMeters : StaticMeters;
    return (
        <Meters
            rows={rows.slice(0, MAX_ROWS)}
            max={max}
            unknown={unknown}
            formatValue={formatValue}
            gapLabel={gapLabel}
            className={className}
        />
    );
}
