import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { HistoryIcon, VerifiedIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RequestLinkForm } from "@/features/auth/components/RequestLinkForm";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { TokenConfirmPanel } from "@/features/auth/components/TokenConfirmPanel";
import { useAsyncAction } from "@/features/auth/hooks/useAsyncAction";
import { LINK_ERROR_CODES } from "@/features/auth/hooks/useAuthFormSubmit";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { destinationFor } from "@/features/auth/hooks/useSignInFlow";
import { selectPendingEmail } from "@/features/auth/slice/authSlice";
import { verifyEmail } from "@/features/auth/slice/registrationSlice";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/**
 * `/verify-email#token=...` (R2, R34, AUTH-32). Opening the link only shows a confirm button; the POST that
 * consumes the token happens on the click. An expired, used or unknown link shows one generic message and a
 * "send a new link" form; a signed-in, already verified visitor is told so instead of burning the token.
 */
export default function VerifyEmailPage() {
    const { t } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { token, hasToken } = useFragmentToken();
    const { user, isAuthenticated } = useAuth();
    const pendingEmail = useAppSelector(selectPendingEmail);
    const [invalid, setInvalid] = useState(!hasToken);
    const [verified, setVerified] = useState(false);
    const { run, pending, failure, cooldownSec } = useAsyncAction();
    const alreadyVerified =
        isAuthenticated && user?.emailVerified === true && !verified;
    const showsInvalid = invalid && !alreadyVerified;

    let titleKey = "verifyEmail.title";
    if (alreadyVerified) titleKey = "verifyEmail.already.title";
    else if (showsInvalid) titleKey = "verifyInvalid.title";
    useDocumentTitle(t("common:documentTitle", { page: t(titleKey) }));

    function confirm() {
        run(
            async () => {
                const session = await dispatch(verifyEmail({ token })).unwrap();
                setVerified(true);
                navigate(destinationFor(session.user), { replace: true });
            },
            (error) => {
                if (error.code !== LINK_ERROR_CODES.VERIFY_TOKEN_INVALID)
                    return false;
                setInvalid(true);
                return true;
            }
        );
    }

    if (alreadyVerified)
        return (
            <StatePanel
                focusTitle
                icon={VerifiedIcon}
                tone="success"
                title={t("verifyEmail.already.title")}
                body={t("verifyEmail.already.body")}
                primary={{
                    label: t("verifyEmail.already.action"),
                    to: PATHS.dashboard,
                }}
            />
        );

    if (showsInvalid)
        return (
            <StatePanel
                focusTitle
                icon={HistoryIcon}
                tone="warning"
                title={t("verifyInvalid.title")}
                body={t("verifyInvalid.body")}
                secondary={{
                    label: t("verifyInvalid.secondary"),
                    to: PATHS.login,
                }}
            >
                <RequestLinkForm defaultEmail={pendingEmail ?? ""} />
            </StatePanel>
        );

    return (
        <TokenConfirmPanel
            icon={VerifiedIcon}
            title={t("verifyEmail.title")}
            body={t("verifyEmail.subtitle")}
            confirmLabel={t("verifyEmail.confirm")}
            onConfirm={confirm}
            pending={pending}
            failure={failure}
            cooldownSec={cooldownSec}
        >
            <Button asChild variant="link" className="self-start px-0">
                <Link to={PATHS.login}>{t("verifyInvalid.secondary")}</Link>
            </Button>
        </TokenConfirmPanel>
    );
}
