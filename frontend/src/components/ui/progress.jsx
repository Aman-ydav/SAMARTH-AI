import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Progress({ className, value, ...props }) {
    const percent = Math.min(100, Math.max(0, value || 0));

    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            value={value}
            className={cn(
                "relative flex h-2 w-full items-center overflow-x-clip rounded-full bg-muted",
                className
            )}
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                className="size-full flex-1 -translate-x-[calc(100%-var(--progress-value))] bg-primary transition-transform motion-reduce:transition-none"
                style={{ "--progress-value": `${percent}%` }}
            />
        </ProgressPrimitive.Root>
    );
}

export { Progress };
