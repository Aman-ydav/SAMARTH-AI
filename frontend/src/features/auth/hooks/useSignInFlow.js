import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useReturnTo } from "@/features/auth/hooks/useReturnTo";
import { API_ERROR_CODES } from "@/lib/apiError";
import { DEFAULT_HOME_PATH, PATHS } from "@/lib/paths";

/** Where a freshly signed-in user goes: forced password change, then onboarding, then the safe return path. */
export function destinationFor(user, returnTo = DEFAULT_HOME_PATH) {
    if (user?.mustChangePassword) return PATHS.changePassword;
    if (user?.needsOnboarding) return PATHS.onboarding;
    return returnTo || DEFAULT_HOME_PATH;
}

/**
 * Outcome handling shared by password login and Google sign-in (AUTH-45): navigation after success and
 * routing of the status codes that have their own page (locked, suspended, deactivated). The return path
 * is validated by `useReturnTo` (path only, AUTH-57) and carried along to the state pages.
 */
export function useSignInFlow({ reactivating = false } = {}) {
    const navigate = useNavigate();
    const explicitReturn = useReturnTo(null);

    const onSuccess = useCallback(
        (session) => {
            if (session?.reactivate) return "reactivated";
            navigate(destinationFor(session?.user, explicitReturn), {
                replace: true,
            });
            return "navigated";
        },
        [navigate, explicitReturn]
    );

    const onFailure = useCallback(
        (error, { email } = {}) => {
            const carry = explicitReturn ? { returnTo: explicitReturn } : null;
            switch (error.code) {
                case API_ERROR_CODES.ACCOUNT_LOCKED:
                    navigate(
                        PATHS.accountLocked,
                        carry ? { state: carry } : {}
                    );
                    return true;
                case API_ERROR_CODES.ACCOUNT_SUSPENDED:
                    navigate(PATHS.accountSuspended);
                    return true;
                case API_ERROR_CODES.ACCOUNT_DEACTIVATED:
                    if (reactivating) return false;
                    navigate(PATHS.accountDeactivated, {
                        state: { ...carry, email },
                    });
                    return true;
                default:
                    return false;
            }
        },
        [navigate, explicitReturn, reactivating]
    );

    return { onSuccess, onFailure, returnTo: explicitReturn };
}
