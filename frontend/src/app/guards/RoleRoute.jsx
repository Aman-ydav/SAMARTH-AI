import { Navigate, Outlet } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { selectCurrentUser } from "@/features/auth";
import { hasRole } from "@/lib/permissions";
import { PATHS } from "@/lib/paths";

/**
 * Layout guard with an explicit role array (FE-54, AUTH-60: list `superadmin` yourself).
 * Client checks are UX only; the server enforces the same rule (FE-55).
 */
export function RoleRoute({ roles }) {
    const user = useAppSelector(selectCurrentUser);
    if (!user) return null;
    if (!hasRole(user, roles))
        return <Navigate to={PATHS.unauthorized} replace />;
    return <Outlet />;
}
