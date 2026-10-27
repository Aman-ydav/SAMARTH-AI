import { MAX_LEVEL } from "@/features/marketing/data/heroMock";
import { cn } from "@/lib/utils";

const fill =
    "absolute inset-y-0 left-0 w-full origin-left transition-[scale,opacity] duration-700 ease-out motion-reduce:transition-none";

/**
 * Level bar for the product mocks (ANIM-61, ANIM-70): the track, the required level in the warning token (so the
 * gap shows as the difference), the current level on top, and a tick at the required level. Fills are scaled on X
 * from CSS variables and the required layer fades in with opacity, so a change animates transform and opacity only.
 * `ticks` adds the 0 to 5 scale marks under the bar.
 */
export function MockLevelBar({
    level,
    required,
    showRequired = true,
    ticks = false,
    className,
}) {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <div
                data-slot="mock-level-bar"
                style={{
                    "--level": level / MAX_LEVEL,
                    "--required": required / MAX_LEVEL,
                    "--required-at": `${(required / MAX_LEVEL) * 100}%`,
                }}
                className="relative h-2 overflow-clip rounded-full bg-muted"
            >
                <span
                    data-slot="mock-level-required"
                    className={cn(
                        fill,
                        "scale-x-(--required) bg-warning",
                        showRequired ? "opacity-100" : "opacity-0"
                    )}
                />
                <span
                    data-slot="mock-level-current"
                    className={cn(fill, "scale-x-(--level) bg-primary")}
                />
                <span
                    data-slot="mock-level-tick"
                    className={cn(
                        "absolute inset-y-0 left-(--required-at) w-0.5 -translate-x-full bg-foreground transition-opacity duration-700 motion-reduce:transition-none",
                        showRequired ? "opacity-100" : "opacity-0"
                    )}
                />
            </div>
            {ticks ? (
                <div
                    aria-hidden="true"
                    className="flex justify-between font-mono text-muted-foreground"
                >
                    {Array.from({ length: MAX_LEVEL + 1 }, (_, index) => (
                        <span key={index} className="type-caption">
                            {index}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
