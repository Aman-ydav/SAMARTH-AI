import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { MailCloseIcon } from "@/components/icons";
import { AcceptInviteForm } from "@/features/auth/components/AcceptInviteForm";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { StatePanel } from "@/features/auth/components/StatePanel";
import { useFragmentToken } from "@/features/auth/hooks/useFragmentToken";
import { destinationFor } from "@/features/auth/hooks/useSignInFlow";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PATHS } from "@/lib/paths";

/** Where "contact support" points until the team publishes a real support address (docs/23 section 8, item 1). */
const SUPPORT_PATH = `${PATHS.terms}#changes`;

/**
 * `/accept-invite#token=...` (doc 20 section 8). The fragment token is read once, stripped and held in state; the
 * form is the confirm step and its POST is the only thing that consumes the invitation. Expired, revoked, used
 * and unknown invitations all show the same message.
 */
export default function AcceptInvitePage() {
    const { t } = useTranslation(["auth", "common"]);
    const navigate = useNavigate();
    const { token, hasToken } = useFragmentToken();
    const [invalid, setInvalid] = useState(!hasToken);

    useDocumentTitle(
        t("common:documentTitle", {
            page: t(invalid ? "inviteInvalid.title" : "acceptInvite.title"),
        })
    );

    if (invalid)
        return (
            <StatePanel
                focusTitle
                icon={MailCloseIcon}
                tone="warning"
                title={t("inviteInvalid.title")}
                body={t("inviteInvalid.body")}
                primary={{
                    label: t("inviteInvalid.primary"),
                    to: PATHS.login,
                }}
                secondary={{
                    label: t("inviteInvalid.secondary"),
                    to: SUPPORT_PATH,
                }}
            />
        );

    return (
        <AuthCard
            title={t("acceptInvite.title")}
            description={t("acceptInvite.subtitle")}
        >
            <AcceptInviteForm
                token={token}
                onInvalid={() => setInvalid(true)}
                onAccepted={(session) =>
                    navigate(destinationFor(session.user), { replace: true })
                }
            />
        </AuthCard>
    );
}
