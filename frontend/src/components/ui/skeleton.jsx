import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                "rounded-md bg-muted motion-safe:animate-pulse",
                className
            )}
            {...props}
        />
    );
}

export { Skeleton };
