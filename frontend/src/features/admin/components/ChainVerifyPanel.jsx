import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import {
    CheckCircleIcon,
    ErrorIcon,
    ShieldIcon,
    SpinnerIcon,
} from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    fetchChainStatus,
    selectChain,
} from "@/features/admin/slice/auditSlice";
import { STATUS } from "@/lib/asyncState";
import { formatDateTime } from "@/lib/format";

/**
 * "Chain integrity" for platform admins (doc 10 section 5): runs the real hash-chain check when the screen opens (a result
 * younger than a minute is reused) and again on request. The result is shown as a title, a sentence and an icon, never by
 * colour alone (UI-07). A failed run keeps the last result next to the error. The button is disabled while a check runs, so a
 * double click sends one request (EDGE-30).
 */
export function ChainVerifyPanel() {
    const { t, i18n } = useTranslation("admin");
    const dispatch = useAppDispatch();
    const { status, error, data } = useAppSelector(selectChain);
    const checking = status === STATUS.LOADING;

    useEffect(() => {
        dispatch(fetchChainStatus());
    }, [dispatch]);

    const verify = () => dispatch(fetchChainStatus({ force: true }));
    const checkedAt = data?.verifiedAt
        ? t("audit.chain.verifiedAt", {
              time: formatDateTime(data.verifiedAt, i18n.language),
          })
        : "";

    return (
        <section
            aria-labelledby="audit-chain-title"
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
        >
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2
                        id="audit-chain-title"
                        className="type-h3 text-card-foreground"
                    >
                        {t("audit.chain.title")}
                    </h2>
                    <p className="max-w-prose text-muted-foreground">
                        {t("audit.chain.description")}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    disabled={checking}
                    aria-busy={checking}
                    onClick={verify}
                >
                    {checking ? (
                        <SpinnerIcon
                            className="motion-safe:animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <ShieldIcon aria-hidden="true" />
                    )}
                    {data
                        ? t("audit.chain.verifyAgain")
                        : t("audit.chain.verify")}
                </Button>
            </header>
            {checking && !data && (
                <p role="status" className="text-muted-foreground">
                    {t("audit.chain.checking")}
                </p>
            )}
            {status === STATUS.FAILED && (
                <LoadErrorAlert error={error} onRetry={verify} />
            )}
            {data?.valid === true && (
                <Alert variant="success">
                    <CheckCircleIcon aria-hidden="true" />
                    <AlertTitle>{t("audit.chain.intactTitle")}</AlertTitle>
                    <AlertDescription>
                        <p>
                            {t("audit.chain.intactBody", {
                                count: data.count ?? 0,
                            })}
                        </p>
                        {checkedAt && <p>{checkedAt}</p>}
                    </AlertDescription>
                </Alert>
            )}
            {data?.valid === false && (
                <Alert variant="destructive">
                    <ErrorIcon aria-hidden="true" />
                    <AlertTitle>{t("audit.chain.brokenTitle")}</AlertTitle>
                    <AlertDescription>
                        <p>
                            {t("audit.chain.brokenBody", {
                                seq: data.brokenAtSeq ?? 0,
                            })}
                        </p>
                        {checkedAt && <p>{checkedAt}</p>}
                    </AlertDescription>
                </Alert>
            )}
        </section>
    );
}
