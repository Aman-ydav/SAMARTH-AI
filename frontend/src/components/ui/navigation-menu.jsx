import * as React from "react";
import { cva } from "class-variance-authority";
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function NavigationMenu({ className, children, viewport = true, ...props }) {
    return (
        <NavigationMenuPrimitive.Root
            data-slot="navigation-menu"
            data-viewport={viewport}
            className={cn(
                "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
                className
            )}
            {...props}
        >
            {children}
            {viewport && <NavigationMenuViewport />}
        </NavigationMenuPrimitive.Root>
    );
}

function NavigationMenuList({ className, ...props }) {
    return (
        <NavigationMenuPrimitive.List
            data-slot="navigation-menu-list"
            className={cn(
                "group flex flex-1 list-none items-center justify-center gap-1",
                className
            )}
            {...props}
        />
    );
}

function NavigationMenuItem({ className, ...props }) {
    return (
        <NavigationMenuPrimitive.Item
            data-slot="navigation-menu-item"
            className={cn("relative", className)}
            {...props}
        />
    );
}

const navigationMenuTriggerStyle = cva(
    "group/navigation-menu-trigger inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-open:bg-accent data-open:text-accent-foreground"
);

function NavigationMenuTrigger({ className, children, ...props }) {
    return (
        <NavigationMenuPrimitive.Trigger
            data-slot="navigation-menu-trigger"
            className={cn(navigationMenuTriggerStyle(), "group", className)}
            {...props}
        >
            {children}{" "}
            <ChevronDownIcon
                className="relative top-px ml-1 size-4 transition-transform group-data-open/navigation-menu-trigger:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
            />
        </NavigationMenuPrimitive.Trigger>
    );
}

function NavigationMenuContent({ className, ...props }) {
    return (
        <NavigationMenuPrimitive.Content
            data-slot="navigation-menu-content"
            data-lenis-prevent=""
            className={cn(
                "top-0 left-0 w-full p-2 group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-md group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:border-border group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow-md data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out md:absolute md:w-auto group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95",
                className
            )}
            {...props}
        />
    );
}

function NavigationMenuViewport({ className, ...props }) {
    return (
        <div className="absolute top-full left-0 isolate z-50 flex justify-center">
            <NavigationMenuPrimitive.Viewport
                data-slot="navigation-menu-viewport"
                className={cn(
                    "origin-top-center relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md md:w-(--radix-navigation-menu-viewport-width) data-open:animate-in data-open:zoom-in-95 data-closed:animate-out data-closed:zoom-out-95",
                    className
                )}
                {...props}
            />
        </div>
    );
}

function NavigationMenuLink({ className, ...props }) {
    return (
        <NavigationMenuPrimitive.Link
            data-slot="navigation-menu-link"
            className={cn(
                "flex min-h-10 items-center gap-2 rounded-md p-2 text-sm transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background in-data-[slot=navigation-menu-content]:rounded-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4",
                className
            )}
            {...props}
        />
    );
}

function NavigationMenuIndicator({ className, ...props }) {
    return (
        <NavigationMenuPrimitive.Indicator
            data-slot="navigation-menu-indicator"
            className={cn(
                "top-full z-30 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
                className
            )}
            {...props}
        >
            <div className="relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border" />
        </NavigationMenuPrimitive.Indicator>
    );
}

export {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuContent,
    NavigationMenuTrigger,
    NavigationMenuLink,
    NavigationMenuIndicator,
    NavigationMenuViewport,
    navigationMenuTriggerStyle,
};
