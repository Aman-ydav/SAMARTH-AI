import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { GoogleIcon, InfoIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { GoogleCredentialButton } from "@/features/auth/components/GoogleCredentialButton";
import { GoogleUnlinkDialog } from "@/features/auth/components/GoogleUnlinkDialog";
import { SectionCard } from "@/features/auth/components/SectionCard";
import { useAsyncAction } from "@/features/auth/hooks/useAsyncAction";
import { useNotify } from "@/features/auth/hooks/useNotify";
import { loginWithGoogle } from "@/features/auth/slice/authSlice";
import { env } from "@/lib/env";

/**
 * Link or unlink Google. There is no dedicated link endpoint: a signed-in person posts a Google credential to
 * `POST /auth/google`, which links when the Google email matches this account. A credential for another account would sign
 * the person in as that account instead, so the screen names the expected email and reports the outcome truthfully.
 */
export function GoogleLinkSection({ user }) {
    const { t } = useTranslation("auth");
    const dispatch = useAppDispatch();
    const notify = useNotify();
    const link = useAsyncAction();
    const [confirmUnlink, setConfirmUnlink] = useState(false);
    const [outcome, setOutcome] = useState(null);
    const linked = (user.authProviders ?? []).includes("google");
    const hasPassword = user.hasPassword !== false;
    const { run } = link;

    if (!env.googleEnabled && !linked) return null;

    function handleCredential(credential) {
        setOutcome(null);
        run(async () => {
            const session = await dispatch(
                loginWithGoogle({ credential })
            ).unwrap();
            setOutcome(session.user.id === user.id ? "linkedNow" : "switched");
        });
    }

    async function handleUnlinked() {
        setOutcome("unlinked");
        await notify(
            "success",
            t("settings.google.unlinked"),
            "google-unlinked"
        );
    }

    return (
        <SectionCard
            title={t("settings.google.heading")}
            description={t("settings.google.description")}
        >
            <p className="flex items-center gap-2 text-sm">
                <GoogleIcon aria-hidden="true" className="size-5" />
                <Badge variant={linked ? "success" : "outline"}>
                    {t(
                        linked
                            ? "settings.google.linked"
                            : "settings.google.notLinked"
                    )}
                </Badge>
            </p>
            {linked ? (
                <div className="flex flex-col items-start gap-3">
                    {!hasPassword && (
                        <Alert variant="info">
                            <InfoIcon aria-hidden="true" />
                            <AlertDescription>
                                {t("settings.google.onlyMethod")}
                            </AlertDescription>
                        </Alert>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!hasPassword || !env.googleEnabled}
                        onClick={() => setConfirmUnlink(true)}
                    >
                        {t("settings.google.unlink")}
                    </Button>
                    <GoogleUnlinkDialog
                        open={confirmUnlink}
                        onOpenChange={setConfirmUnlink}
                        onUnlinked={handleUnlinked}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-3" aria-busy={link.pending}>
                    <p className="text-sm text-muted-foreground">
                        {t("settings.google.linkHelp", { email: user.email })}
                    </p>
                    <GoogleCredentialButton onCredential={handleCredential} />
                </div>
            )}
            {outcome && (
                <p role="status" className="text-sm">
                    {t(`settings.google.${outcome}`)}
                </p>
            )}
            <FormFailureAlert
                failure={link.failure}
                cooldownSec={link.cooldownSec}
            />
        </SectionCard>
    );
}
