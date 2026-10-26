import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { ErrorIcon, ForbidIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logoutUser, useAuth } from "@/features/auth";
import { StatePage } from "@/features/marketing/components/StatePage";
import { PATHS } from "@/lib/paths";

export default function UnauthorizedPage() {
    const { t } = useTranslation("errors");
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [switching, setSwitching] = useState(false);
    const [failed, setFailed] = useState(false);

    // A signed-in visitor cannot open the login page (guest route), so end the session first (FE-59: only
    // continue when the server confirmed it; on failure stay signed in and say so).
    async function switchAccount() {
        setSwitching(true);
        setFailed(false);
        try {
            await dispatch(logoutUser()).unwrap();
            navigate(PATHS.login);
        } catch {
            setFailed(true);
        } finally {
            setSwitching(false);
        }
    }

    return (
        <StatePage
            icon={ForbidIcon}
            title={t("unauthorized.title")}
            body={t("unauthorized.body")}
            primary={{ label: t("unauthorized.primary"), to: PATHS.dashboard }}
            secondary={
                isAuthenticated
                    ? {
                          label: t("unauthorized.secondary"),
                          onClick: switchAccount,
                          disabled: switching,
                      }
                    : { label: t("unauthorized.secondary"), to: PATHS.login }
            }
        >
            {switching ? (
                <p role="status" className="type-small text-muted-foreground">
                    {t("pages.unauthorized.switching")}
                </p>
            ) : null}
            {failed ? (
                <Alert variant="destructive">
                    <ErrorIcon aria-hidden="true" />
                    <AlertDescription>
                        {t("codes.NETWORK_ERROR")}
                    </AlertDescription>
                </Alert>
            ) : null}
        </StatePage>
    );
}
