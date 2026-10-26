import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    MoreHorizontalIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }) {
    const { t } = useTranslation("common");

    return (
        <nav
            role="navigation"
            aria-label={t("ui.pagination")}
            data-slot="pagination"
            className={cn("mx-auto flex w-full justify-center", className)}
            {...props}
        />
    );
}

function PaginationContent({ className, ...props }) {
    return (
        <ul
            data-slot="pagination-content"
            className={cn("flex items-center gap-1", className)}
            {...props}
        />
    );
}

function PaginationItem({ ...props }) {
    return <li data-slot="pagination-item" {...props} />;
}

function PaginationLink({ className, isActive, size = "icon", ...props }) {
    return (
        <Button
            asChild
            variant={isActive ? "outline" : "ghost"}
            size={size}
            className={cn(className)}
        >
            <a
                aria-current={isActive ? "page" : undefined}
                data-slot="pagination-link"
                data-active={isActive}
                {...props}
            />
        </Button>
    );
}

function PaginationPrevious({ className, text, ...props }) {
    const { t } = useTranslation("common");

    return (
        <PaginationLink
            aria-label={t("ui.goToPreviousPage")}
            size="default"
            className={cn("pl-2!", className)}
            {...props}
        >
            <ChevronLeftIcon aria-hidden="true" />
            <span className="hidden sm:block">{text ?? t("ui.previous")}</span>
        </PaginationLink>
    );
}

function PaginationNext({ className, text, ...props }) {
    const { t } = useTranslation("common");

    return (
        <PaginationLink
            aria-label={t("ui.goToNextPage")}
            size="default"
            className={cn("pr-2!", className)}
            {...props}
        >
            <span className="hidden sm:block">{text ?? t("next")}</span>
            <ChevronRightIcon aria-hidden="true" />
        </PaginationLink>
    );
}

function PaginationEllipsis({ className, ...props }) {
    const { t } = useTranslation("common");

    return (
        <span
            data-slot="pagination-ellipsis"
            className={cn(
                "flex size-10 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
                className
            )}
            {...props}
        >
            <MoreHorizontalIcon aria-hidden="true" />
            <span className="sr-only">{t("ui.morePages")}</span>
        </span>
    );
}

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
};
