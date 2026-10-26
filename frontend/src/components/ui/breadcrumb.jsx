import * as React from "react";
import { Slot } from "radix-ui";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, MoreHorizontalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }) {
    const { t } = useTranslation("common");

    return (
        <nav
            aria-label={t("ui.breadcrumb")}
            data-slot="breadcrumb"
            className={cn(className)}
            {...props}
        />
    );
}

function BreadcrumbList({ className, ...props }) {
    return (
        <ol
            data-slot="breadcrumb-list"
            className={cn(
                "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground sm:gap-2.5",
                className
            )}
            {...props}
        />
    );
}

function BreadcrumbItem({ className, ...props }) {
    return (
        <li
            data-slot="breadcrumb-item"
            className={cn("inline-flex items-center gap-1.5", className)}
            {...props}
        />
    );
}

function BreadcrumbLink({ asChild, className, ...props }) {
    const Comp = asChild ? Slot.Root : "a";

    return (
        <Comp
            data-slot="breadcrumb-link"
            className={cn(
                "rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className
            )}
            {...props}
        />
    );
}

function BreadcrumbPage({ className, ...props }) {
    return (
        <span
            data-slot="breadcrumb-page"
            role="link"
            aria-disabled="true"
            aria-current="page"
            className={cn("font-medium text-foreground", className)}
            {...props}
        />
    );
}

function BreadcrumbSeparator({ children, className, ...props }) {
    return (
        <li
            data-slot="breadcrumb-separator"
            role="presentation"
            aria-hidden="true"
            className={cn("[&>svg]:size-4", className)}
            {...props}
        >
            {children ?? <ChevronRightIcon />}
        </li>
    );
}

function BreadcrumbEllipsis({ className, ...props }) {
    const { t } = useTranslation("common");

    return (
        <span
            data-slot="breadcrumb-ellipsis"
            role="presentation"
            className={cn(
                "flex size-6 items-center justify-center [&>svg]:size-4",
                className
            )}
            {...props}
        >
            <MoreHorizontalIcon aria-hidden="true" />
            <span className="sr-only">{t("ui.more")}</span>
        </span>
    );
}

export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbEllipsis,
};
