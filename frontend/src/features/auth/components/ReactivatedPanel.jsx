import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { CheckCircleIcon } from "@/components/icons";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useReturnTo } from "@/features/auth/hooks/useReturnTo";
import { destinationFor } from "@/features/auth/hooks/useSignInFlow";
import {
    reactivationAcknowledged,
    selectCurrentUser,
} from "@/features/auth/slice/authSlice";

/**
 * Confirm screen after signing in to an account that was deactivated or waiting for deletion (R18): the login
 * succeeded, the deletion is cancelled, and the person acknowledges it before moving on.
 */
export function ReactivatedPanel() {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector(selectCurrentUser);
    const afterPath = useReturnTo();

    function carryOn() {
        dispatch(reactivationAcknowledged());
        navigate(destinationFor(user, afterPath), { replace: true });
    }

    return (
        <StatePanel
            focusTitle
            icon={CheckCircleIcon}
            tone="success"
            title={t("login.reactivated.title")}
            body={t("login.reactivated.body")}
            primary={{ label: t("login.reactivated.action"), onClick: carryOn }}
        />
    );
}
