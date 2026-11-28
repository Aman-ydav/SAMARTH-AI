import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { ShieldIcon } from "@/components/icons";
import { AuditTable } from "@/features/admin/components/AuditTable";
import { ListEmptyState } from "@/features/admin/components/ListEmptyState";
import { ListPagination } from "@/features/admin/components/ListPagination";
import { ListSkeleton } from "@/features/admin/components/ListSkeleton";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import {
    fetchAuditEntries,
    selectAuditEntries,
    selectAuditError,
    selectAuditLoadedKey,
    selectAuditMeta,
    selectAuditStatus,
} from "@/features/admin/slice/auditSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * The audit entries with all four data states (FE-93): a skeleton until the first answer, an error with Retry, an empty state
 * that words itself differently when a filter is on, and the table with paging. A failed refresh keeps the old rows and
 * shows the error above them. A page past the last one moves to the last page (FE-26).
 */
export function AuditList({ query, setQuery, showOrganisation, onRefresh }) {
    const { t } = useTranslation("admin");
    const dispatch = useAppDispatch();
    const entries = useAppSelector(selectAuditEntries);
    const meta = useAppSelector(selectAuditMeta);
    const status = useAppSelector(selectAuditStatus);
    const error = useAppSelector(selectAuditError);
    const loadedKey = useAppSelector(selectAuditLoadedKey);

    useEffect(() => {
        dispatch(fetchAuditEntries(query));
    }, [dispatch, query]);

    const hasData = loadedKey === queryKeyOf(query);
    const { page } = query;
    const { totalPages } = meta;
    useEffect(() => {
        if (hasData && totalPages > 0 && page > totalPages)
            setQuery({ page: totalPages });
    }, [hasData, page, totalPages, setQuery]);

    const filtered = Boolean(query.action || query.from || query.to);
    let body;
    if (!hasData && status === STATUS.FAILED) {
        body = <LoadErrorAlert error={error} onRetry={onRefresh} />;
    } else if (!hasData) {
        body = <ListSkeleton label={t("audit.loadingLabel")} />;
    } else if (entries.length === 0) {
        body = (
            <ListEmptyState
                icon={ShieldIcon}
                title={t(
                    filtered ? "audit.empty.filteredTitle" : "audit.empty.title"
                )}
                body={t(
                    filtered ? "audit.empty.filteredBody" : "audit.empty.body"
                )}
                action={
                    filtered
                        ? {
                              label: t("audit.empty.clear"),
                              onClick: () =>
                                  setQuery({
                                      action: undefined,
                                      from: undefined,
                                      to: undefined,
                                  }),
                          }
                        : undefined
                }
            />
        );
    } else {
        body = (
            <>
                {status === STATUS.FAILED && (
                    <LoadErrorAlert error={error} onRetry={onRefresh} />
                )}
                <AuditTable
                    entries={entries}
                    showOrganisation={showOrganisation}
                />
            </>
        );
    }

    return (
        <section className="flex flex-col gap-4">
            {body}
            {hasData && (
                <ListPagination
                    meta={meta}
                    disabled={status === STATUS.LOADING}
                    onPageChange={(next) => setQuery({ page: next })}
                />
            )}
        </section>
    );
}
