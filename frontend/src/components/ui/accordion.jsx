import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function Accordion({ className, ...props }) {
    return (
        <AccordionPrimitive.Root
            data-slot="accordion"
            className={cn("flex w-full flex-col", className)}
            {...props}
        />
    );
}

function AccordionItem({ className, ...props }) {
    return (
        <AccordionPrimitive.Item
            data-slot="accordion-item"
            className={cn(
                "not-last:border-b not-last:border-border",
                className
            )}
            {...props}
        />
    );
}

function AccordionTrigger({ className, children, ...props }) {
    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                data-slot="accordion-trigger"
                className={cn(
                    "group/accordion-trigger relative flex min-h-10 flex-1 items-start justify-between gap-2 rounded-md py-4 text-left text-sm font-medium transition-colors outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
                    className
                )}
                {...props}
            >
                {children}
                <ChevronDownIcon
                    aria-hidden="true"
                    data-slot="accordion-trigger-icon"
                    className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
                />
                <ChevronUpIcon
                    aria-hidden="true"
                    data-slot="accordion-trigger-icon"
                    className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
                />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    );
}

function AccordionContent({ className, children, ...props }) {
    return (
        <AccordionPrimitive.Content
            data-slot="accordion-content"
            className="overflow-hidden text-sm"
            {...props}
        >
            <div
                className={cn(
                    "pt-0 pb-4 [&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-4",
                    className
                )}
            >
                {children}
            </div>
        </AccordionPrimitive.Content>
    );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
