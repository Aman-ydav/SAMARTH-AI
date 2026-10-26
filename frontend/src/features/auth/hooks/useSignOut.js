import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { errorMessageKey } from "@/lib/apiError";
import { PATHS } from "@/lib/paths";
import {
    logoutAllDevices,
    logoutUser,
} from "@/features/auth/slice/sessionsSlice";

/**
 * Sign out of this device or all devices (FE-59). Success: the listeners reset the app and notify other tabs,
 * and we also navigate to /login. A network or 5xx failure keeps the user signed in and says so with a toast.
 * `pending` is `"one"`, `"all"` or null so buttons can disable themselves and avoid a double submit.
 */
export function useSignOut() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation("errors");
    const [pending, setPending] = useState(null);
    const busy = useRef(false);

    async function run(kind, thunk) {
        if (busy.current) return;
        busy.current = true;
        setPending(kind);
        try {
            await dispatch(thunk()).unwrap();
            navigate(PATHS.login, { replace: true });
        } catch (error) {
            /* Imported on demand: the toast library stays out of the entry chunk (FE-111) and is already cached by the Toaster. */
            const { toast } = await import("sonner");
            toast.error(
                t(errorMessageKey(error?.code), {
                    defaultValue: t("codes.UNKNOWN"),
                }),
                { id: "sign-out-failed" }
            );
        } finally {
            busy.current = false;
            setPending(null);
        }
    }

    return {
        pending,
        signOut: () => run("one", logoutUser),
        signOutEverywhere: () => run("all", logoutAllDevices),
    };
}
