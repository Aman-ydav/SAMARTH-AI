import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
                outline:
                    "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80 aria-expanded:bg-accent aria-expanded:text-accent-foreground",
                ghost: "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80 aria-expanded:bg-accent aria-expanded:text-accent-foreground",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
                link: "text-primary-text underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4",
                sm: "h-9 px-3",
                lg: "h-11 px-6",
                icon: "size-10",
                "icon-sm": "size-9",
                "icon-lg": "size-11",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
