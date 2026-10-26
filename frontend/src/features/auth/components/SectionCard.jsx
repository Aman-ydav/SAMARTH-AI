import { useId } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One settings section: a labelled region with a heading (`h2`), a short description and the section's content.
 * `tone="destructive"` frames dangerous actions with the destructive border token.
 */
export function SectionCard({ title, description, tone, children }) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId}>
            <Card
                className={cn(
                    tone === "destructive" && "border-destructive-border"
                )}
            >
                <CardHeader>
                    <h2 id={headingId} className="type-h3">
                        {title}
                    </h2>
                    {description && (
                        <CardDescription className="max-w-prose text-pretty">
                            {description}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {children}
                </CardContent>
            </Card>
        </section>
    );
}
