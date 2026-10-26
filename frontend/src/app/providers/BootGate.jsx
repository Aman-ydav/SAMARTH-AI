import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { BootSplash } from "@/app/providers/BootSplash";
import { Button } from "@/components/ui/button";
import {
    fetchCurrentUser,
    selectAuthError,
    selectAuthStatus,
    selectIsBootstrapped,
} from "@/features/auth";

/**
 * Holds the app back until `/auth/me` has been answered (FE-53). A transient boot failure shows Retry;
 * it never silently treats the visitor as anonymous.
 */
export function BootGate({ children }) {
    const { t } = useTranslation("errors");
    const dispatch = useAppDispatch();
    const bootstrapped = useAppSelector(selectIsBootstrapped);
    const status = useAppSelector(selectAuthStatus);
    const error = useAppSelector(selectAuthError);

    if (bootstrapped) return children;
    if (status !== "failed") return <BootSplash />;

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
        >
            <h1 className="text-2xl font-semibold">{t("boot.title")}</h1>
            <p className="max-w-md text-muted-foreground">{t("boot.body")}</p>
            {error?.requestId ? (
                <p className="text-sm text-muted-foreground">
                    {t("requestId", { id: error.requestId })}
                </p>
            ) : null}
            <Button onClick={() => dispatch(fetchCurrentUser({ force: true }))}>
                {t("boot.retry")}
            </Button>
        </main>
    );
}
