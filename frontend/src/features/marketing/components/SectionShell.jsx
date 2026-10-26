import { cn } from "@/lib/utils";

/**
 * Shared frame for a landing section: landmark labelled by its h2, max-w-7xl container with page gutters
 * (UI-41, UI-42) and an optional intro paragraph. `id` becomes `<id>-title` for the heading.
 */
export function SectionShell({
    id,
    title,
    intro,
    children,
    className,
    containerClassName,
    headingClassName,
}) {
    const titleId = `${id}-title`;
    return (
        <section
            aria-labelledby={titleId}
            className={cn("py-12 md:py-20", className)}
        >
            <div
                className={cn(
                    "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
                    containerClassName
                )}
            >
                <h2
                    id={titleId}
                    className={cn(
                        "type-h1 max-w-3xl text-foreground",
                        headingClassName
                    )}
                >
                    {title}
                </h2>
                {intro ? (
                    <p className="mt-4 max-w-2xl type-body-lg text-muted-foreground">
                        {intro}
                    </p>
                ) : null}
                {children}
            </div>
        </section>
    );
}
