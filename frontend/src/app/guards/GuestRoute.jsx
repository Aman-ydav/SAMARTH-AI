import { Navigate, Outlet, useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { selectAuthGate } from "@/features/auth";
import { PATHS } from "@/lib/paths";
import { readReturnTo } from "@/lib/safeRedirect";

/**
 * Layout guard for sign-in and sign-up pages (FE-54): a signed-in visitor is sent on to their destination.
 * While a "welcome back, deletion cancelled" confirm screen is pending the guard stays out of the way.
 */
export function GuestRoute({ signedInTo }) {
    const gate = useAppSelector(selectAuthGate);
    const location = useLocation();

    if (!gate.bootstrapped) return null;
    if (!gate.user || gate.reactivated) return <Outlet />;

    if (gate.mustChangePassword)
        return <Navigate to={PATHS.changePassword} replace />;
    const afterSignIn = gate.needsOnboarding
        ? PATHS.onboarding
        : readReturnTo(location);
    return <Navigate to={signedInTo || afterSignIn} replace />;
}
