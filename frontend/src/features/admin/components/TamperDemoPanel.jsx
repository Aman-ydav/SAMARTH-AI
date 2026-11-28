import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
    CheckCircleIcon,
    ErrorIcon,
    SpinnerIcon,
    WarningIcon,
} from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuditErrorText } from "@/features/admin/hooks/useAuditErrorText";
import {
    auditSimulationCleared,
    selectChain,
    selectSimulation,
    simulateTamper,
} from "@/features/admin/slice/auditSlice";
import { STATUS } from "@/lib/asyncState";

/**
 * "Simulate tampering" (doc 10 section 5). It appears only when the server reports the demo switched on, which it learns from
 * the chain check, and only for platform admins (the parent mounts it for them). The server alters one entry in a COPY and
 * reports where the check breaks; stored records never change, and the panel says so. A result left from an earlier visit is
 * cleared when the panel unmounts. The button is disabled while a run is in flight (EDGE-30).
 */
export function TamperDemoPanel() {
    const { t } = useTranslation("admin");
    const dispatch = useAppDispatch();
    const chain = useAppSelector(selectChain);
    const { status, error, result } = useAppSelector(selectSimulation);
    const errorText = useAuditErrorText();
    const running = status === STATUS.LOADING;

    useEffect(() => () => dispatch(auditSimulationCleared()), [dispatch]);

    if (chain.data?.tamperDemoEnabled !== true) return null;

    return (
        <section
            aria-labelledby="audit-demo-title"
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
        >
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2
                        id="audit-demo-title"
                        className="type-h3 text-card-foreground"
                    >
                        {t("audit.demo.title")}
                    </h2>
                    <p className="max-w-prose text-muted-foreground">
                        {t("audit.demo.description")}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    disabled={running}
                    aria-busy={running}
                    onClick={() => dispatch(simulateTamper(undefined))}
                >
                    {running && (
                        <SpinnerIcon
                            className="motion-safe:animate-spin"
                            aria-hidden="true"
                        />
                    )}
                    {running ? t("audit.demo.running") : t("audit.demo.run")}
                </Button>
            </header>
            {status === STATUS.FAILED && (
                <Alert variant="destructive">
                    <ErrorIcon aria-hidden="true" />
                    <AlertDescription>{errorText(error)}</AlertDescription>
                </Alert>
            )}
            {result?.detected && (
                <Alert variant="success">
                    <CheckCircleIcon aria-hidden="true" />
                    <AlertTitle>{t("audit.demo.detectedTitle")}</AlertTitle>
                    <AlertDescription>
                        <p>
                            {t("audit.demo.detectedBody", {
                                tampered: result.tamperedSeq,
                                window: result.windowSize,
                                broken: result.after.brokenAtSeq ?? 0,
                            })}
                        </p>
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                            <dt className="font-medium">
                                {t("audit.demo.before")}
                            </dt>
                            <dd>{t("audit.demo.intact")}</dd>
                            <dt className="font-medium">
                                {t("audit.demo.after")}
                            </dt>
                            <dd>
                                {t("audit.demo.brokenAt", {
                                    seq: result.after.brokenAtSeq ?? 0,
                                })}
                            </dd>
                        </dl>
                    </AlertDescription>
                </Alert>
            )}
            {result && !result.detected && (
                <Alert variant="warning">
                    <WarningIcon aria-hidden="true" />
                    <AlertTitle>{t("audit.demo.inconclusiveTitle")}</AlertTitle>
                    <AlertDescription>
                        {t("audit.demo.inconclusiveBody", {
                            seq: result.before.brokenAtSeq ?? 0,
                        })}
                    </AlertDescription>
                </Alert>
            )}
        </section>
    );
}
