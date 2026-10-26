import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useMatches } from "react-router";
import { useAuth } from "@/features/auth";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBreadcrumbs } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb trail built from the nav config and the deepest route `handle.title` (UI-61). Below `md` it keeps
 * the parent and the current page; below `sm` only the current page. The last crumb carries `aria-current`.
 */
export function TopbarBreadcrumbs() {
    const { pathname } = useLocation();
    const { t } = useTranslation("nav");
    const { user } = useAuth();
    const matches = useMatches();
    const titleKey = matches.findLast((match) => match.handle?.title)?.handle
        .title;
    const trail = getBreadcrumbs(
        pathname,
        user,
        titleKey ? t(titleKey) : "",
        t
    );
    const last = trail.length - 1;

    /* Index from the end: 0 = current, 1 = parent. Earlier crumbs show from `md`, the parent from `sm`. */
    const visibility = (index) => {
        const fromEnd = last - index;
        if (fromEnd === 0) return "";
        return fromEnd === 1
            ? "hidden sm:inline-flex"
            : "hidden md:inline-flex";
    };

    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-2">
                {trail.map((crumb, index) => (
                    <Fragment key={crumb.id}>
                        {index > 0 ? (
                            <BreadcrumbSeparator
                                className={visibility(index - 1).replace(
                                    "inline-flex",
                                    "block"
                                )}
                            />
                        ) : null}
                        <BreadcrumbItem
                            className={cn("min-w-0", visibility(index))}
                        >
                            {crumb.to ? (
                                <BreadcrumbLink asChild>
                                    <Link to={crumb.to}>{crumb.label}</Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage className="truncate">
                                    {crumb.label}
                                </BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
