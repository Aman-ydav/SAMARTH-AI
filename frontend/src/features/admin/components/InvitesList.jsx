import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { MailSendIcon } from "@/components/icons";
import {
    InvitesTable,
    MAX_RESENDS,
} from "@/features/admin/components/InvitesTable";
import { InvitesToolbar } from "@/features/admin/components/InvitesToolbar";
import { ListEmptyState } from "@/features/admin/components/ListEmptyState";
import { ListPagination } from "@/features/admin/components/ListPagination";
import { ListSkeleton } from "@/features/admin/components/ListSkeleton";
import { useAdminErrorText } from "@/features/admin/hooks/useAdminErrorText";
import { useRowAction } from "@/features/admin/hooks/useRowAction";
import { queryKeyOf } from "@/features/admin/schemas/adminSchemas";
import {
    fetchInvites,
    resendInvite,
    revokeInvite,
    selectAllInvites,
    selectInvitesError,
    selectInvitesLoadedKey,
    selectInvitesMeta,
    selectInvitesStatus,
} from "@/features/admin/slice/invitesSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * The invitation list with its status filter, pagination and the two row actions behind confirm dialogs. All four data
 * states are shown (FE-93): a skeleton until the current query has data, an error with Retry, an empty state (different
 * wording when a filter is on) and the table. A read that fails while old data is shown keeps the table and adds the error.
 */
export function InvitesList({ query, setQuery, onRefresh }) {
    const { t } = useTranslation("admin");
    const dispatch = useAppDispatch();
    const invites = useAppSelector(selectAllInvites);
    const meta = useAppSelector(selectInvitesMeta);
    const status = useAppSelector(selectInvitesStatus);
    const error = useAppSelector(selectInvitesError);
    const loadedKey = useAppSelector(selectInvitesLoadedKey);
    const [resendTarget, setResendTarget] = useState(null);
    const [revokeTarget, setRevokeTarget] = useState(null);
    const errorText = useAdminErrorText("invites");
    const { busyId, run } = useRowAction({ errorText, onRefresh });

    useEffect(() => {
        dispatch(fetchInvites(query));
    }, [dispatch, query]);

    const hasData = loadedKey === queryKeyOf(query);
    const { page } = query;
    const { totalPages } = meta;
    useEffect(() => {
        // A page past the end (a stale link, or rows revoked meanwhile) moves to the last page (FE-26).
        if (hasData && totalPages > 0 && page > totalPages)
            setQuery({ page: totalPages });
    }, [hasData, page, totalPages, setQuery]);

    const filtered = Boolean(query.status);
    const resend = () =>
        run(
            resendTarget.id,
            () => dispatch(resendInvite({ id: resendTarget.id })).unwrap(),
            t("invites.resend.done", { email: resendTarget.email })
        );
    const revoke = () =>
        run(
            revokeTarget.id,
            () => dispatch(revokeInvite({ id: revokeTarget.id })).unwrap(),
            t("invites.revoke.done", { email: revokeTarget.email })
        );

    let body;
    if (!hasData && status === STATUS.FAILED) {
        body = <LoadErrorAlert error={error} onRetry={onRefresh} />;
    } else if (!hasData) {
        body = <ListSkeleton label={t("invites.loadingLabel")} />;
    } else if (invites.length === 0) {
        body = (
            <ListEmptyState
                icon={MailSendIcon}
                title={t(
                    filtered
                        ? "invites.empty.filteredTitle"
                        : "invites.empty.title"
                )}
                body={t(
                    filtered
                        ? "invites.empty.filteredBody"
                        : "invites.empty.body"
                )}
                action={
                    filtered
                        ? {
                              label: t("invites.empty.clear"),
                              onClick: () => setQuery({ status: undefined }),
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
                <InvitesTable
                    invites={invites}
                    busyId={busyId}
                    onResend={setResendTarget}
                    onRevoke={setRevokeTarget}
                />
            </>
        );
    }

    return (
        <section
            aria-labelledby="invites-list-title"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="invites-list-title" className="type-h3 text-foreground">
                    {t("invites.list.title")}
                </h2>
                <InvitesToolbar
                    status={query.status}
                    loading={status === STATUS.LOADING}
                    onStatusChange={(value) => setQuery({ status: value })}
                    onRefresh={onRefresh}
                />
            </div>
            {body}
            {hasData && (
                <ListPagination
                    meta={meta}
                    disabled={busyId !== null}
                    onPageChange={(next) => setQuery({ page: next })}
                />
            )}
            <ConfirmActionDialog
                open={resendTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setResendTarget(null);
                }}
                destructive={false}
                title={t("invites.resend.title")}
                description={t("invites.resend.body", {
                    email: resendTarget?.email ?? "",
                    used: resendTarget?.resentCount ?? 0,
                    max: MAX_RESENDS,
                })}
                actionLabel={t("invites.resend.action")}
                onConfirm={resend}
            />
            <ConfirmActionDialog
                open={revokeTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRevokeTarget(null);
                }}
                title={t("invites.revoke.title")}
                description={t("invites.revoke.body", {
                    email: revokeTarget?.email ?? "",
                })}
                actionLabel={t("invites.revoke.action")}
                onConfirm={revoke}
            />
        </section>
    );
}
