import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { ErrorWarningIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { env } from "@/lib/env";

const BUTTON_WIDTH_MOBILE = 260;
const BUTTON_WIDTH_DESKTOP = 320;

function CredentialSection({ onCredential }) {
    const { t, i18n } = useTranslation("auth");
    const isMobile = useIsMobile();
    const [attempt, setAttempt] = useState(0);
    const [problem, setProblem] = useState(null);

    function handleSuccess(response) {
        if (!response?.credential) {
            setProblem("failed");
            return;
        }
        setProblem(null);
        onCredential(response.credential);
    }

    return (
        <div className="flex flex-col gap-3">
            <div
                role="group"
                aria-label={t("googleStatus.group")}
                className="flex min-h-10"
            >
                <GoogleOAuthProvider
                    key={attempt}
                    clientId={env.googleClientId}
                    locale={i18n.resolvedLanguage}
                    onScriptLoadError={() => setProblem("blocked")}
                >
                    <GoogleLogin
                        onSuccess={handleSuccess}
                        onError={() => setProblem("failed")}
                        text="continue_with"
                        shape="rectangular"
                        size="large"
                        width={
                            isMobile
                                ? BUTTON_WIDTH_MOBILE
                                : BUTTON_WIDTH_DESKTOP
                        }
                    />
                </GoogleOAuthProvider>
            </div>
            {problem && (
                <Alert variant="warning">
                    <ErrorWarningIcon aria-hidden="true" />
                    <AlertDescription className="flex flex-col items-start gap-2">
                        <p>{t(`googleStatus.${problem}`)}</p>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setProblem(null);
                                setAttempt((value) => value + 1);
                            }}
                        >
                            {t("googleStatus.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

/**
 * Google button that only hands back a fresh credential (FE-63): used to re-authenticate sensitive changes for accounts that
 * sign in with Google, and to link Google. The credential is never decoded or stored here; the caller sends it to the API
 * once and drops it. Renders nothing when no client id is configured, so the provider script loads on these screens only.
 */
export function GoogleCredentialButton({ onCredential }) {
    if (!env.googleEnabled) return null;
    return <CredentialSection onCredential={onCredential} />;
}
