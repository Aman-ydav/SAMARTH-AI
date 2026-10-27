import { useTranslation } from "react-i18next";
import { ErrorIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorMessageKey } from "@/lib/apiError";

/**
 * Failed read inside a settings screen (FE-93, FE-108): the message comes from the error code, 5xx failures add the
 * request id, and Retry runs the read again. Shown in place of the data, never as a toast.
 */
export function LoadErrorAlert({ error, onRetry }) {
    const { t } = useTranslation(["errors", "common"]);
    const showsRequestId = error?.requestId && error.statusCode >= 500;
    return (
        <Alert variant="destructive">
            <ErrorIcon aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-2">
                <p>
                    {t(errorMessageKey(error?.code), {
                        defaultValue: t("codes.UNKNOWN"),
                    })}
                </p>
                {showsRequestId && (
                    <p className="type-caption font-mono">
                        {t("requestId", { id: error.requestId })}
                    </p>
                )}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onRetry}
                >
                    {t("common:retry")}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
