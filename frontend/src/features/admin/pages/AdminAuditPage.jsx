import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { AdminPageFrame } from "@/features/admin/components/AdminPageFrame";
import { AuditFilters } from "@/features/admin/components/AuditFilters";
import { AuditList } from "@/features/admin/components/AuditList";
import { ChainVerifyPanel } from "@/features/admin/components/ChainVerifyPanel";
import { TamperDemoPanel } from "@/features/admin/components/TamperDemoPanel";
import { useListParams } from "@/features/admin/hooks/useListParams";
import { parseAuditQuery } from "@/features/admin/schemas/auditSchemas";
import {
    fetchAuditEntries,
    selectAuditStatus,
} from "@/features/admin/slice/auditSlice";
import { useAuth } from "@/features/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { STATUS } from "@/lib/asyncState";
import { ROLES } from "@/lib/permissions";

/**
 * `/admin/audit` (doc 10 section 5, doc 08 section 6.4): the tamper-evident record of important actions. Admins read the
 * events of their own organisation; platform admins read every organisation and also get the chain check and, when the server
 * has it switched on, the tampering demo. Hiding those panels is UX; the API answers 403 to anyone else (FE-55).
 */
export default function AdminAuditPage() {
    const { t } = useTranslation(["admin", "common"]);
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { query, setQuery } = useListParams(parseAuditQuery);
    const status = useAppSelector(selectAuditStatus);
    const platformAdmin = user?.role === ROLES.SUPERADMIN;

    useDocumentTitle(
        t("common:documentTitle", { page: t("admin:audit.title") })
    );

    const refresh = useCallback(
        () => dispatch(fetchAuditEntries({ ...query, force: true })),
        [dispatch, query]
    );

    return (
        <AdminPageFrame
            title={t("admin:audit.title")}
            description={t(
                platformAdmin
                    ? "admin:audit.subtitlePlatform"
                    : "admin:audit.subtitleAdmin"
            )}
        >
            {platformAdmin && (
                <>
                    <ChainVerifyPanel />
                    <TamperDemoPanel />
                </>
            )}
            <AuditFilters
                query={query}
                setQuery={setQuery}
                loading={status === STATUS.LOADING}
                onRefresh={refresh}
            />
            <AuditList
                query={query}
                setQuery={setQuery}
                showOrganisation={platformAdmin}
                onRefresh={refresh}
            />
        </AdminPageFrame>
    );
}
