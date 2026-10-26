import { useAppSelector } from "@/app/hooks";
import { selectAuthGate } from "@/features/auth/slice/authSlice";

/** Read-only view of who is signed in; the server stays the authority (FE-55). */
export function useAuth() {
    const gate = useAppSelector(selectAuthGate);
    return {
        user: gate.user,
        role: gate.user?.role ?? null,
        isAuthenticated: gate.user !== null,
        bootstrapped: gate.bootstrapped,
        needsOnboarding: gate.needsOnboarding,
        mustChangePassword: gate.mustChangePassword,
    };
}
