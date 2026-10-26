import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
    "group/alert relative grid w-full gap-0.5 rounded-lg border p-4 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-5",
    {
        variants: {
            variant: {
                default: "border-border bg-card text-card-foreground",
                success:
                    "border-success-border bg-success-subtle text-success-subtle-foreground",
                warning:
                    "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
                info: "border-info-border bg-info-subtle text-info-subtle-foreground",
                destructive:
                    "border-destructive-border bg-destructive-subtle text-destructive-subtle-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

function Alert({ className, variant, ...props }) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4",
                className
            )}
            {...props}
        />
    );
}

function AlertDescription({ className, ...props }) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                "text-sm group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-4",
                className
            )}
            {...props}
        />
    );
}

function AlertAction({ className, ...props }) {
    return (
        <div
            data-slot="alert-action"
            className={cn("absolute top-3 right-4", className)}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
