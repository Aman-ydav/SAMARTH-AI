import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/app/hooks";
import { ErrorWarningIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormFailureAlert } from "@/features/auth/components/FormFailureAlert";
import { useAsyncAction } from "@/features/auth/hooks/useAsyncAction";
import { loginWithGoogle } from "@/features/auth/slice/authSlice";
import { useIsMobile } from "@/hooks/useMobile";
import { env } from "@/lib/env";

const BUTTON_WIDTH_MOBILE = 280;
const BUTTON_WIDTH_DESKTOP = 360;

/** One-time nonce bound into the Google ID token; the server compares it when sent (AUTH-42). Component state only. */
function randomNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        ""
    );
}

function GoogleSection({ onSession, onFailure, reactivate, withDivider }) {
    const { t, i18n } = useTranslation(["auth", "common"]);
    const dispatch = useAppDispatch();
    const isMobile = useIsMobile();
    const { run, pending, failure, cooldownSec, clearFailure } =
        useAsyncAction();
    const [attempt, setAttempt] = useState(0);
    const [nonce] = useState(randomNonce);
    const [problem, setProblem] = useState(null);

    function handleSuccess(response) {
        const credential = response?.credential;
        if (!credential) {
            setProblem("failed");
            return;
        }
        setProblem(null);
        run(
            async () => {
                const session = await dispatch(
                    loginWithGoogle({
                        credential,
                        nonce,
                        ...(reactivate ? { reactivate: true } : {}),
                    })
                ).unwrap();
                onSession(session);
            },
            (error) => onFailure?.(error)
        );
    }

    function retry() {
        setProblem(null);
        clearFailure();
        setAttempt((value) => value + 1);
    }

    return (
        <div className="flex flex-col gap-4">
            {withDivider && <FieldSeparator>{t("common:or")}</FieldSeparator>}
            <div
                role="group"
                aria-label={t("auth:googleStatus.group")}
                className="flex min-h-10 justify-center"
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
                        nonce={nonce}
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
            {pending && (
                <p
                    role="status"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                    <Spinner />
                    {t("common:loading")}
                </p>
            )}
            {problem && (
                <Alert variant="warning">
                    <ErrorWarningIcon aria-hidden="true" />
                    <AlertDescription className="flex flex-col items-start gap-2">
                        <p>{t(`auth:googleStatus.${problem}`)}</p>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={retry}
                        >
                            {t("auth:googleStatus.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <FormFailureAlert failure={failure} cooldownSec={cooldownSec} />
        </div>
    );
}

/**
 * "Continue with Google" (FE-63, AUTH-41). The Google provider and its script are mounted here only, so they load
 * on the login and sign-up pages alone, and only when a client id is configured; without one nothing renders.
 * The credential is posted untouched through `loginWithGoogle` and never decoded or trusted on the client.
 * A blocked script or a cancelled popup shows a message with a retry; password sign-in keeps working.
 */
export function GoogleButton({
    onSession,
    onFailure,
    reactivate = false,
    withDivider = true,
}) {
    if (!env.googleEnabled) return null;
    return (
        <GoogleSection
            onSession={onSession}
            onFailure={onFailure}
            reactivate={reactivate}
            withDivider={withDivider}
        />
    );
}
