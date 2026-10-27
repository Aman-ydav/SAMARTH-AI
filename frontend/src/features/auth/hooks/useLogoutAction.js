import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { logoutUser } from "@/features/auth/slice/sessionsSlice";
import { PATHS } from "@/lib/paths";

/**
 * Log out from an auth state page. Logout is honest (FE-59): on success or an already-ended session the visitor
 * goes to /login; on a network or server failure they stay put and `failure` explains that nothing changed.
 */
export function useLogoutAction() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const action = useAsyncAction();
    const { run } = action;

    const logout = () =>
        run(async () => {
            await dispatch(logoutUser()).unwrap();
            navigate(PATHS.login, { replace: true });
        });

    return {
        logout,
        pending: action.pending,
        failure: action.failure,
        cooldownSec: action.cooldownSec,
    };
}
