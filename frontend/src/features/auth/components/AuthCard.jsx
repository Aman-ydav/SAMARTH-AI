import { useEffect, useRef } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
    default: "bg-accent text-accent-foreground",
    success: "bg-success-subtle text-success-subtle-foreground",
    warning: "bg-warning-subtle text-warning-subtle-foreground",
    destructive: "bg-destructive-subtle text-destructive-subtle-foreground",
    info: "bg-info-subtle text-info-subtle-foreground",
};

/**
 * The card every auth screen is drawn in: optional status icon, the page's one `h1`, a description, content and
 * a footer. `focusTitle` moves keyboard focus to the heading when this card replaces another one on the same
 * route (for example "check your inbox" after the forgot-password form), so screen readers announce the change.
 */
export function AuthCard({
    title,
    description,
    icon: Icon,
    tone = "default",
    focusTitle = false,
    footer,
    className,
    children,
}) {
    const titleRef = useRef(null);

    useEffect(() => {
        if (focusTitle) titleRef.current?.focus();
    }, [focusTitle]);

    return (
        <main id="main-content" tabIndex={-1} className="w-full outline-none">
            <Card className={cn("w-full", className)}>
                <CardHeader>
                    {Icon && (
                        <span
                            className={cn(
                                "mb-2 flex size-12 items-center justify-center rounded-full",
                                TONES[tone] ?? TONES.default
                            )}
                        >
                            <Icon aria-hidden="true" className="size-6" />
                        </span>
                    )}
                    <h1
                        ref={titleRef}
                        tabIndex={-1}
                        className="type-h2 text-balance outline-none"
                    >
                        {title}
                    </h1>
                    {description && (
                        <CardDescription className="text-pretty">
                            {description}
                        </CardDescription>
                    )}
                </CardHeader>
                {children && <CardContent>{children}</CardContent>}
                {footer && (
                    <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
                        {footer}
                    </CardFooter>
                )}
            </Card>
        </main>
    );
}
