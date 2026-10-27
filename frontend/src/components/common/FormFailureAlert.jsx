import { useTranslation } from "react-i18next";
import { ErrorIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessageKey } from "@/lib/apiError";
import { formatCountdown } from "@/lib/format";

/**
 * The form-level server error, always above the submit button as a `role="alert"` (FE-76, FE-107). The text comes
 * from `errors:codes.<CODE>` (or the caller's translated `message` for codes a screen words itself) and never from the server body; 5xx failures add the request id (FE-108) and a 429
 * adds the remaining wait.
 */
export function FormFailureAlert({
    failure,
    cooldownSec = 0,
    message,
    children,
}) {
    const { t } = useTranslation(["auth", "errors"]);
    if (!failure) return null;

    return (
        <Alert variant="destructive">
            <ErrorIcon aria-hidden="true" />
            <AlertDescription className="flex flex-col gap-1">
                <p>
                    {message ??
                        t(errorMessageKey(failure.code), {
                            defaultValue: t("errors:codes.UNKNOWN"),
                        })}
                </p>
                {cooldownSec > 0 && (
                    <p>
                        {t("auth:rateLimit.retryIn", {
                            time: formatCountdown(cooldownSec),
                        })}
                    </p>
                )}
                {failure.requestId && (
                    <p className="type-caption font-mono">
                        {t("errors:requestId", { id: failure.requestId })}
                    </p>
                )}
                {children}
            </AlertDescription>
        </Alert>
    );
}
