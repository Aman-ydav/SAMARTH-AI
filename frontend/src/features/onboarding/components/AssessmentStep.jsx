import { useTranslation } from "react-i18next";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
    MAX_LEVEL,
    MAX_RATED_COMPETENCIES,
    ratingsSchema,
} from "@/features/onboarding/schemas/onboardingSchemas";
import { STATUS } from "@/lib/asyncState";

const LEVELS = Array.from({ length: MAX_LEVEL + 1 }, (_, level) => level);

/** Step 2: rate yourself 0 to 5 on up to 12 competencies from the framework. */
export function AssessmentStep({
    framework,
    ratings,
    onRate,
    onRetry,
    onBack,
    onNext,
}) {
    const { t } = useTranslation("common");
    const items = framework.items.slice(0, MAX_RATED_COMPETENCIES);
    const valid = ratingsSchema.safeParse(ratings).success;

    if (framework.status === STATUS.IDLE || framework.status === STATUS.LOADING) {
        return (
            <div
                className="flex flex-col gap-4"
                aria-busy="true"
                aria-label={t("loading")}
            >
                {[0, 1, 2].map((key) => (
                    <Skeleton key={key} className="h-16 w-full" />
                ))}
            </div>
        );
    }
    if (framework.status === STATUS.FAILED) {
        return <LoadErrorAlert error={framework.error} onRetry={onRetry} />;
    }
    if (items.length === 0) {
        return (
            <p className="text-muted-foreground">
                {t("onboarding.assessment.empty")}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
                {t("onboarding.assessment.hint", { max: MAX_LEVEL })}
            </p>
            <ul className="flex flex-col gap-5">
                {items.map((competency) => {
                    const groupId = `rate-${competency.id}`;
                    return (
                        <li key={competency.id} className="flex flex-col gap-2">
                            <span
                                id={groupId}
                                className="font-medium text-foreground"
                            >
                                {competency.name}
                            </span>
                            <RadioGroup
                                aria-labelledby={groupId}
                                value={
                                    ratings[competency.id] === undefined
                                        ? ""
                                        : String(ratings[competency.id])
                                }
                                onValueChange={(value) =>
                                    onRate(competency.id, Number(value))
                                }
                                className="flex flex-wrap gap-4"
                            >
                                {LEVELS.map((level) => (
                                    <div
                                        key={level}
                                        className="flex items-center gap-2"
                                    >
                                        <RadioGroupItem
                                            id={`${groupId}-${level}`}
                                            value={String(level)}
                                        />
                                        <Label htmlFor={`${groupId}-${level}`}>
                                            {level}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </li>
                    );
                })}
            </ul>
            {!valid && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("onboarding.assessment.needOne")}
                </p>
            )}
            <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={onBack}>
                    {t("back")}
                </Button>
                <Button type="button" disabled={!valid} onClick={onNext}>
                    {t("next")}
                </Button>
            </div>
        </div>
    );
}
