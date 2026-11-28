import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ErrorIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorMessageKey } from "@/lib/apiError";
import { PATHS } from "@/lib/paths";

const ATTEMPT_LIMIT = "QUIZ_ATTEMPT_LIMIT";

/**
 * Failed submission. 429 QUIZ_ATTEMPT_LIMIT has its own clear message; other 4xx show the server code's message and
 * cannot be fixed by retrying; 5xx and network failures offer a retry (the answers are still in Redux).
 */
export function SubmitErrorAlert({ error, onRetry }) {
    const { t } = useTranslation(["common", "errors"]);
    const status = error?.statusCode ?? 0;
    const limit = error?.code === ATTEMPT_LIMIT;
    const retryable = !limit && (status === 0 || status >= 500);
    const message = limit
        ? t("common:quiz.errors.attemptLimit")
        : t(errorMessageKey(error?.code), {
              defaultValue: t("errors:codes.UNKNOWN"),
          });

    return (
        <Alert variant="destructive" role="alert">
            <ErrorIcon aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-2">
                <p>{message}</p>
                {status >= 500 && error?.requestId ? (
                    <p className="type-caption font-mono">
                        {t("errors:requestId", { id: error.requestId })}
                    </p>
                ) : null}
                {retryable ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                    >
                        {t("common:retry")}
                    </Button>
                ) : (
                    <Button asChild size="sm" variant="outline">
                        <Link to={PATHS.quizzes}>
                            {t("common:quiz.backToQuizzes")}
                        </Link>
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
}
