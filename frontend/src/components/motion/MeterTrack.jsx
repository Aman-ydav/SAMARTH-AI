import { cn } from "@/lib/utils";

const bar = "absolute inset-y-0 left-0 w-full origin-left";

/**
 * Track of one meter (part of SCROLL_METERS, ANIM-47): the required level in the warning token under the current
 * level, plus the required tick. With motion values `fill` (scaleX) and `gapOpacity` it is driven by scroll, without
 * them it is the static final state (the level then comes from the `--level` variable of the row). `Animated` is
 * `motion.span` when driven (passed in so this file needs no motion import).
 */
export function MeterTrack({
    required,
    max,
    fill,
    gapOpacity,
    Animated = "span",
}) {
    const Layer = fill ? Animated : "span";
    const Gap = gapOpacity ? Animated : "span";
    return (
        <div
            style={{
                "--required": required / max,
                "--required-at": `${(required / max) * 100}%`,
            }}
            className="relative h-2.5 flex-1 overflow-clip rounded-full bg-muted"
        >
            <Gap
                style={gapOpacity ? { opacity: gapOpacity } : undefined}
                className={cn(bar, "scale-x-(--required) bg-warning")}
            />
            <Layer
                style={fill ? { scaleX: fill } : undefined}
                className={cn(bar, "bg-primary", !fill && "scale-x-(--level)")}
            />
            <Gap
                style={gapOpacity ? { opacity: gapOpacity } : undefined}
                className="absolute inset-y-0 left-(--required-at) w-0.5 -translate-x-full bg-foreground"
            />
        </div>
    );
}
