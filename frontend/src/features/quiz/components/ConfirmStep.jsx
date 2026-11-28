import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { SubmitButton } from "@/components/common/SubmitButton";
import { Button } from "@/components/ui/button";
import { SubmitErrorAlert } from "@/features/quiz/components/SubmitErrorAlert";
import { STATUS } from "@/lib/asyncState";

/** Confirmation before submitting: how many are answered, which are not, and the single-flight Submit button. */
export const ConfirmStep = forwardRef(function ConfirmStep(
    { questions, answers, submit, onBack, onGoTo, onSubmit },
    ref
) {
    const { t } = useTranslation("common");
    const pending = submit.status === STATUS.LOADING;
    const answered = questions.filter((q) => answers[q.id] !== undefined);
    const unanswered = questions
        .map((q, index) => ({ q, index }))
        .filter(({ q }) => answers[q.id] === undefined);

    return (
        <section aria-labelledby="quiz-confirm" className="flex flex-col gap-5">
            <h2
                id="quiz-confirm"
                ref={ref}
                tabIndex={-1}
                className="type-h3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                {t("quiz.confirm.title")}
            </h2>
            <p>
                {t("quiz.confirm.summary", {
                    answered: answered.length,
                    total: questions.length,
                })}
            </p>
            {unanswered.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        {t("quiz.confirm.unanswered")}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                        {unanswered.map(({ q, index }) => (
                            <li key={q.id}>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={pending}
                                    onClick={() => onGoTo(index)}
                                >
                                    {t("quiz.confirm.goTo", { number: index + 1 })}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {submit.status === STATUS.FAILED && (
                <SubmitErrorAlert error={submit.error} onRetry={onSubmit} />
            )}
            <div className="flex justify-between gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onBack}
                >
                    {t("back")}
                </Button>
                <SubmitButton
                    type="button"
                    className="w-auto"
                    pending={pending}
                    onClick={onSubmit}
                >
                    {t("quiz.confirm.submit")}
                </SubmitButton>
            </div>
        </section>
    );
});
