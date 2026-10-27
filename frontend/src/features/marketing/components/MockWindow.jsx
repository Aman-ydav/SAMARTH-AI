import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Application window frame for the How-it-works visuals: a title bar (three token-coloured dots, the screen name and
 * a demo-data badge) over a bordered body. Flat, no shadow (ANIM-62).
 */
export function MockWindow({ title, demoLabel, className, children }) {
    return (
        <div
            data-slot="mock-window"
            className={cn(
                "w-full overflow-clip rounded-lg border border-border bg-card text-card-foreground",
                className
            )}
        >
            <div className="flex h-10 items-center gap-3 border-b border-border bg-muted px-4">
                <span aria-hidden="true" className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                </span>
                <span className="type-small font-medium text-foreground">
                    {title}
                </span>
                <Badge variant="info" className="ml-auto">
                    {demoLabel}
                </Badge>
            </div>
            {children}
        </div>
    );
}
