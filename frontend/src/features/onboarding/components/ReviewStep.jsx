import { useTranslation } from "react-i18next";
import { ErrorIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/common/SubmitButton";
import { Button } from "@/components/ui/button";
import { errorMessageKey } from "@/lib/apiError";
import { STATUS } from "@/lib/asyncState";

/** Step 3: read-only summary and the single-flight Finish button. */
export function ReviewStep({
    profile,
    roles,
    framework,
    ratings,
    submit,
    onBack,
    onFinish,
}) {
    const { t } = useTranslation(["common", "errors"]);
    const pending = submit.status === STATUS.LOADING;
    const roleTitle =
        roles.items.find((role) => String(role.id) === profile.targetRole)
            ?.title ?? profile.targetRole;
    const rated = framework.items.filter(
        (competency) => ratings[competency.id] !== undefined
    );
    const rows = [
        ["designation", profile.designation],
        ["department", profile.department],
        ["yearsOfService", profile.yearsOfService],
        ["targetRole", roleTitle],
    ];

    return (
        <div className="flex flex-col gap-6">
            <dl className="grid gap-3 sm:grid-cols-2">
                {rows.map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                        <dt className="text-sm text-muted-foreground">
                            {t(`common:onboarding.role.${key}`)}
                        </dt>
                        <dd className="font-medium text-foreground">{value}</dd>
                    </div>
                ))}
            </dl>
            <section className="flex flex-col gap-2">
                <h3 className="type-h4 text-foreground">
                    {t("common:onboarding.review.ratings")}
                </h3>
                <ul className="flex flex-col gap-1">
                    {rated.map((competency) => (
                        <li
                            key={competency.id}
                            className="flex justify-between gap-4 text-sm"
                        >
                            <span>{competency.name}</span>
                            <span className="font-medium">
                                {t("common:onboarding.review.outOf", {
                                    level: ratings[competency.id],
                                })}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
            {submit.status === STATUS.FAILED && (
                <Alert variant="destructive" role="alert">
                    <ErrorIcon aria-hidden="true" />
                    <AlertDescription>
                        {t(errorMessageKey(submit.error?.code), {
                            defaultValue: t("errors:codes.UNKNOWN"),
                        })}
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex justify-between gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onBack}
                >
                    {t("common:back")}
                </Button>
                <SubmitButton
                    type="button"
                    className="w-auto"
                    pending={pending}
                    onClick={onFinish}
                >
                    {t("common:onboarding.review.finish")}
                </SubmitButton>
            </div>
        </div>
    );
}
