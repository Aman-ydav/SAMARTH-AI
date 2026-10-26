import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessageKey, toApiError } from "@/lib/apiError";
import { useCountdown } from "@/hooks/useCountdown";

const DEFAULT_COOLDOWN_SEC = 60;

/**
 * "Send again" button with a cooldown driven by an absolute deadline (FE-81, AUTH-30). `onResend` must reject
 * with an ApiError on failure (a thunk `.unwrap()` does). A 429 or any failure that carries `retryAfterSec`
 * restarts the countdown from the server's number. The result is always the neutral message, never "sent to x".
 */
export function ResendCountdown({
    onResend,
    label,
    sentMessage,
    cooldownSec = DEFAULT_COOLDOWN_SEC,
    initialSec = 0,
}) {
    const { t } = useTranslation(["auth", "errors"]);
    const { remainingSec, startFor } = useCountdown();
    const [status, setStatus] = useState({ phase: "idle", code: null });

    useEffect(() => {
        if (initialSec > 0) startFor(initialSec);
    }, [initialSec, startFor]);

    const sending = status.phase === "sending";

    async function handleClick() {
        setStatus({ phase: "sending", code: null });
        try {
            await onResend();
            setStatus({ phase: "sent", code: null });
            startFor(cooldownSec);
        } catch (raw) {
            const error = toApiError(raw);
            if (error.retryAfterSec > 0) startFor(error.retryAfterSec);
            setStatus({ phase: "failed", code: error.code });
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant="outline"
                onClick={handleClick}
                disabled={sending || remainingSec > 0}
                aria-busy={sending}
            >
                {sending && <Spinner />}
                {remainingSec > 0
                    ? t("auth:resend.cooldown", { seconds: remainingSec })
                    : (label ?? t("auth:resend.action"))}
            </Button>
            {status.phase === "sent" && (
                <p role="status" className="text-sm text-muted-foreground">
                    {sentMessage ?? t("auth:resend.sent")}
                </p>
            )}
            {status.phase === "failed" && (
                <p role="alert" className="text-sm text-destructive">
                    {t(errorMessageKey(status.code), {
                        defaultValue: t("errors:codes.UNKNOWN"),
                    })}
                </p>
            )}
        </div>
    );
}
