import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, size = "default", ...props }) {
    return (
        <div
            data-slot="card"
            data-size={size}
            className={cn(
                "group/card flex flex-col gap-(--card-spacing) rounded-lg border border-border bg-card py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)]",
                className
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
                className
            )}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }) {
    return (
        <div
            data-slot="card-title"
            className={cn("type-h4", className)}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }) {
    return (
        <div
            data-slot="card-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function CardAction({ className, ...props }) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className
            )}
            {...props}
        />
    );
}

function CardContent({ className, ...props }) {
    return (
        <div
            data-slot="card-content"
            className={cn("flex flex-col gap-3 px-(--card-spacing)", className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }) {
    return (
        <div
            data-slot="card-footer"
            className={cn(
                "flex items-center px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
                className
            )}
            {...props}
        />
    );
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
};
