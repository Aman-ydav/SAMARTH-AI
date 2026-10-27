import { cn } from "@/lib/utils";

/**
 * Wraps one card of a product mock and draws the tour highlight: a primary-token border laid over the card whose
 * `opacity` goes from 0 to 1 (never a ring or shadow transition, ANIM-70, ANIM-64).
 */
export function MockHighlight({ on, className, children }) {
    return (
        <div
            className={cn("relative", className)}
            data-highlighted={on ? "true" : "false"}
        >
            {children}
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none absolute -inset-1.5 rounded-xl border-4 border-primary transition-opacity duration-500 motion-reduce:transition-none",
                    on ? "opacity-100" : "opacity-0"
                )}
            />
        </div>
    );
}
