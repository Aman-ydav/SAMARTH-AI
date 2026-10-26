import { Navigate, Outlet, useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { SESSION_END, selectAuthGate } from "@/features/auth";
import { PATHS } from "@/lib/paths";
import { returnState } from "@/lib/safeRedirect";

/**
 * Layout guard for signed-in areas (FE-54). Renders nothing until the app has hydrated.
 * Anonymous visitors go to /login (or /session-expired after a session end) carrying a safe return path;
 * a forced password change and unfinished onboarding redirect unless the route opts out.
 */
export function ProtectedRoute({
    allowMustChange = false,
    allowOnboarding = false,
}) {
    const gate = useAppSelector(selectAuthGate);
    const location = useLocation();

    if (!gate.bootstrapped) return null;

    if (!gate.user) {
        if (gate.limitedSession)
            return allowMustChange ? (
                <Outlet />
            ) : (
                <Navigate to={PATHS.changePassword} replace />
            );
        if (gate.sessionEnd === SESSION_END.LOGOUT)
            return <Navigate to={PATHS.login} replace />;
        const target = gate.sessionEnd ? PATHS.sessionExpired : PATHS.login;
        return <Navigate to={target} replace state={returnState(location)} />;
    }

    if (gate.mustChangePassword && !allowMustChange)
        return <Navigate to={PATHS.changePassword} replace />;
    if (gate.needsOnboarding && !allowOnboarding && !allowMustChange)
        return <Navigate to={PATHS.onboarding} replace />;
    return <Outlet />;
}
