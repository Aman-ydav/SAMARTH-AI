import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import { LockPasswordIcon } from "@/components/icons";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { FormFailureAlert } from "@/components/common/FormFailureAlert";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useLogoutAction } from "@/features/auth/hooks/useLogoutAction";
import { destinationFor } from "@/features/auth/hooks/useSignInFlow";
import {
    fetchCurrentUser,
    selectCurrentUser,
} from "@/features/auth/slice/authSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * `/change-password` (AUTH-38, R39): the forced change after an administrator set a temporary password. It is
 * reachable with the limited 15-minute session only. Success confirms that the other devices were signed out
 * and then continues into the app; when the response carried no user, `/auth/me` is read again.
 */
export default function ChangePasswordPage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector(selectCurrentUser);
    const [changed, setChanged] = useState(false);
    const session = useLogoutAction();

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(changed ? "mustChange.success.title" : "mustChange.title"),
        })
    );

    function onChanged() {
        setChanged(true);
        if (!user) dispatch(fetchCurrentUser({ force: true }));
    }

    if (changed)
        return (
            <StatePanel
                focusTitle
                icon={LockPasswordIcon}
                tone="success"
                title={t("mustChange.success.title")}
                body={t("mustChange.success.body")}
                primary={{
                    label: t("mustChange.success.action"),
                    onClick: () =>
                        navigate(destinationFor(user), { replace: true }),
                }}
            />
        );

    return (
        <AuthCard
            icon={LockPasswordIcon}
            title={t("mustChange.title")}
            description={t("mustChange.body")}
            footer={
                <>
                    <FormFailureAlert
                        failure={session.failure}
                        cooldownSec={session.cooldownSec}
                    />
                    <Button
                        type="button"
                        variant="link"
                        className="px-0"
                        onClick={session.logout}
                        disabled={session.pending}
                    >
                        {t("mustChange.secondary")}
                    </Button>
                </>
            }
        >
            <ChangePasswordForm onChanged={onChanged} />
        </AuthCard>
    );
}
