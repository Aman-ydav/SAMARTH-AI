import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Common frame of every About section (ANIM-75: one `h2` per section): a labelled `section` with the marketing
 * container, vertical rhythm from UI-41, the heading and an optional intro line.
 */
export function AboutSectionShell({ title, intro, children, className }) {
    const titleId = useId();
    return (
        <section
            aria-labelledby={titleId}
            className={cn(
                "mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8",
                className
            )}
        >
            <h2 id={titleId} className="type-h2 text-balance">
                {title}
            </h2>
            {intro ? (
                <p className="type-body-lg mt-3 max-w-prose text-muted-foreground">
                    {intro}
                </p>
            ) : null}
            <div className="mt-8">{children}</div>
        </section>
    );
}
