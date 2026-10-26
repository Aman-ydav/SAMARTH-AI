import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }) {
    return (
        <RadioGroupPrimitive.Root
            data-slot="radio-group"
            className={cn("grid w-full gap-3", className)}
            {...props}
        />
    );
}

function RadioGroupItem({ className, ...props }) {
    return (
        <RadioGroupPrimitive.Item
            data-slot="radio-group-item"
            className={cn(
                "group/radio-group-item peer relative flex aspect-square size-5 shrink-0 rounded-full border border-input bg-background transition-colors outline-none after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
                className
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="flex size-full items-center justify-center"
            >
                <span className="size-2 rounded-full bg-primary-foreground" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
}

export { RadioGroup, RadioGroupItem };
