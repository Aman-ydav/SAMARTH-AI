import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from "@/components/ui/pagination";

/**
 * Result count plus previous and next for a server-paged list (FE-26). The page itself lives in the URL, so the parent
 * decides what `onPageChange(page)` does. Nothing is shown for an empty result.
 */
export function ListPagination({ meta, onPageChange, disabled = false }) {
    const { t } = useTranslation("admin");
    if (meta.total === 0) return null;
    const pages = Math.max(meta.totalPages, 1);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
                {t("pagination.total", { count: meta.total })}
            </p>
            <Pagination className="mx-0 w-auto">
                <PaginationContent>
                    <PaginationItem>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled || meta.page <= 1}
                            onClick={() => onPageChange(meta.page - 1)}
                        >
                            <ChevronLeftIcon aria-hidden="true" />
                            {t("pagination.previous")}
                        </Button>
                    </PaginationItem>
                    <PaginationItem>
                        <span
                            aria-current="page"
                            className="px-2 text-sm tabular-nums"
                        >
                            {t("pagination.label", {
                                page: meta.page,
                                pages,
                            })}
                        </span>
                    </PaginationItem>
                    <PaginationItem>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled || meta.page >= pages}
                            onClick={() => onPageChange(meta.page + 1)}
                        >
                            {t("pagination.next")}
                            <ChevronRightIcon aria-hidden="true" />
                        </Button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
