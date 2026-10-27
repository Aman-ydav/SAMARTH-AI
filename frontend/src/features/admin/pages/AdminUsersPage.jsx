import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { AdminPageFrame } from "@/features/admin/components/AdminPageFrame";
import { UsersList } from "@/features/admin/components/UsersList";
import { useListParams } from "@/features/admin/hooks/useListParams";
import { parseUsersQuery } from "@/features/admin/schemas/adminSchemas";
import { fetchAdminUsers } from "@/features/admin/slice/adminUsersSlice";
import { useAuth } from "@/features/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ROLES } from "@/lib/permissions";

/**
 * `/admin/users` (R69): the accounts of the organisation with search, role and status filters. Admins suspend and reactivate
 * learners and trainers; platform admins also manage admins and change roles. Hidden actions are UX; the API enforces them.
 */
export default function AdminUsersPage() {
    const { t } = useTranslation(["admin", "common"]);
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { query, setQuery } = useListParams(parseUsersQuery);

    useDocumentTitle(
        t("common:documentTitle", { page: t("admin:users.title") })
    );

    const refresh = useCallback(
        () => dispatch(fetchAdminUsers({ ...query, force: true })),
        [dispatch, query]
    );

    return (
        <AdminPageFrame
            title={t("admin:users.title")}
            description={t(
                user?.role === ROLES.SUPERADMIN
                    ? "admin:users.subtitlePlatform"
                    : "admin:users.subtitleAdmin"
            )}
        >
            <UsersList
                actor={user}
                query={query}
                setQuery={setQuery}
                onRefresh={refresh}
            />
        </AdminPageFrame>
    );
}
