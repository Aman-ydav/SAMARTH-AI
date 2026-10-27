import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { AdminPageFrame } from "@/features/admin/components/AdminPageFrame";
import { InviteForm } from "@/features/admin/components/InviteForm";
import { InvitesList } from "@/features/admin/components/InvitesList";
import { useListParams } from "@/features/admin/hooks/useListParams";
import { parseInvitesQuery } from "@/features/admin/schemas/adminSchemas";
import { fetchInvites } from "@/features/admin/slice/invitesSlice";
import { useAuth } from "@/features/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ROLES, grantableRoles } from "@/lib/permissions";

/**
 * `/admin/invites` (R68, R69): invite a trainer, or as a platform admin also an admin, and manage what was sent. Admins and
 * platform admins only; the role guard is UX, the API enforces the same grants.
 */
export default function AdminInvitesPage() {
    const { t } = useTranslation(["admin", "common"]);
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { query, setQuery } = useListParams(parseInvitesQuery);
    const roles = grantableRoles(user);

    useDocumentTitle(
        t("common:documentTitle", { page: t("admin:invites.title") })
    );

    const refresh = useCallback(
        () => dispatch(fetchInvites({ ...query, force: true })),
        [dispatch, query]
    );
    // A new invitation is the newest row, so go to the first page; on page 1 just read again.
    const onInvited = () => (query.page > 1 ? setQuery({}) : refresh());

    return (
        <AdminPageFrame
            title={t("admin:invites.title")}
            description={t(
                user?.role === ROLES.SUPERADMIN
                    ? "admin:invites.subtitlePlatform"
                    : "admin:invites.subtitleAdmin"
            )}
        >
            <InviteForm role={user?.role} roles={roles} onInvited={onInvited} />
            <InvitesList
                query={query}
                setQuery={setQuery}
                onRefresh={refresh}
            />
        </AdminPageFrame>
    );
}
