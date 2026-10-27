import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { UsersIcon } from "@/components/icons";
import { ListEmptyState } from "@/features/admin/components/ListEmptyState";
import { ListPagination } from "@/features/admin/components/ListPagination";
import { ListSkeleton } from "@/features/admin/components/ListSkeleton";
import { RoleChangeDialog } from "@/features/admin/components/RoleChangeDialog";
import { UserFilters } from "@/features/admin/components/UserFilters";
import { UsersTable } from "@/features/admin/components/UsersTable";
import { useAdminErrorText } from "@/features/admin/hooks/useAdminErrorText";
import { useRowAction } from "@/features/admin/hooks/useRowAction";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import {
    fetchAdminUsers,
    selectAdminUsersError,
    selectAdminUsersLoadedKey,
    selectAdminUsersMeta,
    selectAdminUsersStatus,
    selectAllAdminUsers,
    updateUserStatus,
} from "@/features/admin/slice/adminUsersSlice";
import { STATUS } from "@/lib/asyncState";
import { ROLES } from "@/lib/permissions";

/**
 * The accounts list: filters, table, pagination and the three actions (suspend, reactivate, change role). Suspending and
 * reactivating ask first; changing a role opens its own dialog. All four data states are shown (FE-93) and the empty state
 * words itself differently when a filter is on. A stale row (404 or 409 from the API) reloads the list.
 */
export function UsersList({ actor, query, setQuery, onRefresh }) {
    const { t } = useTranslation("admin");
    const dispatch = useAppDispatch();
    const users = useAppSelector(selectAllAdminUsers);
    const meta = useAppSelector(selectAdminUsersMeta);
    const status = useAppSelector(selectAdminUsersStatus);
    const error = useAppSelector(selectAdminUsersError);
    const loadedKey = useAppSelector(selectAdminUsersLoadedKey);
    const [statusTarget, setStatusTarget] = useState(null);
    const [roleTarget, setRoleTarget] = useState(null);
    const errorText = useAdminErrorText("users");
    const { busyId, run } = useRowAction({ errorText, onRefresh });

    useEffect(() => {
        dispatch(fetchAdminUsers(query));
    }, [dispatch, query]);

    const hasData = loadedKey === queryKeyOf(query);
    const { page } = query;
    const { totalPages } = meta;
    useEffect(() => {
        // A page past the end (a stale link, or rows removed meanwhile) moves to the last page (FE-26).
        if (hasData && totalPages > 0 && page > totalPages)
            setQuery({ page: totalPages });
    }, [hasData, page, totalPages, setQuery]);

    const filtered = Boolean(query.q || query.role || query.status);
    const suspending = statusTarget?.action === "suspend";
    const targetName = statusTarget
        ? statusTarget.user.name || statusTarget.user.email
        : "";
    const changeStatus = () =>
        run(
            statusTarget.user.id,
            () =>
                dispatch(
                    updateUserStatus({
                        id: statusTarget.user.id,
                        status: suspending ? "suspended" : "active",
                    })
                ).unwrap(),
            t(suspending ? "users.suspend.done" : "users.reactivate.done", {
                name: targetName,
            })
        );

    let body;
    if (!hasData && status === STATUS.FAILED) {
        body = <LoadErrorAlert error={error} onRetry={onRefresh} />;
    } else if (!hasData) {
        body = <ListSkeleton label={t("users.loadingLabel")} />;
    } else if (users.length === 0) {
        body = (
            <ListEmptyState
                icon={UsersIcon}
                title={t(
                    filtered ? "users.empty.filteredTitle" : "users.empty.title"
                )}
                body={t(
                    filtered ? "users.empty.filteredBody" : "users.empty.body"
                )}
                action={
                    filtered
                        ? {
                              label: t("users.empty.clear"),
                              onClick: () =>
                                  setQuery({
                                      q: undefined,
                                      role: undefined,
                                      status: undefined,
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
                <UsersTable
                    actor={actor}
                    users={users}
                    busyId={busyId}
                    onStatus={(user, action) =>
                        setStatusTarget({ user, action })
                    }
                    onChangeRole={setRoleTarget}
                />
            </>
        );
    }

    return (
        <section className="flex flex-col gap-4">
            <UserFilters
                query={query}
                setQuery={setQuery}
                canSeePlatformAdmins={actor?.role === ROLES.SUPERADMIN}
                loading={status === STATUS.LOADING}
                onRefresh={onRefresh}
            />
            {body}
            {hasData && (
                <ListPagination
                    meta={meta}
                    disabled={busyId !== null}
                    onPageChange={(next) => setQuery({ page: next })}
                />
            )}
            <ConfirmActionDialog
                open={statusTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setStatusTarget(null);
                }}
                destructive={suspending}
                title={t(
                    suspending
                        ? "users.suspend.title"
                        : "users.reactivate.title",
                    { name: targetName }
                )}
                description={t(
                    suspending ? "users.suspend.body" : "users.reactivate.body",
                    { name: targetName }
                )}
                actionLabel={t(
                    suspending
                        ? "users.suspend.action"
                        : "users.reactivate.action"
                )}
                onConfirm={changeStatus}
            />
            <RoleChangeDialog
                target={roleTarget}
                onClose={() => setRoleTarget(null)}
                onRefresh={onRefresh}
            />
        </section>
    );
}
