import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * One question per screen as a radio group. The heading takes focus when the question changes (the player does that
 * through `ref`). `n` and `p` move between questions (handled by the player).
 */
export const QuestionStep = forwardRef(function QuestionStep(
    { question, index, total, selected, onSelect, onPrevious, onNext },
    ref
) {
    const { t } = useTranslation("common");
    const headingId = `question-${question.id}`;
    const last = index === total - 1;

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-5">
            <h2
                id={headingId}
                ref={ref}
                tabIndex={-1}
                className="type-h3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                <span className="sr-only">
                    {t("quiz.questionOf", { current: index + 1, total })}.{" "}
                </span>
                {question.question}
            </h2>
            <RadioGroup
                aria-labelledby={headingId}
                value={selected === undefined ? "" : String(selected)}
                onValueChange={(value) => onSelect(Number(value))}
                className="flex flex-col gap-3"
            >
                {question.options.map((option, optionIndex) => {
                    const id = `${headingId}-${optionIndex}`;
                    return (
                        <div
                            key={id}
                            className="flex items-center gap-3 rounded-md border border-border p-3"
                        >
                            <RadioGroupItem
                                id={id}
                                value={String(optionIndex)}
                            />
                            <Label htmlFor={id} className="flex-1 cursor-pointer">
                                {option}
                            </Label>
                        </div>
                    );
                })}
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
                {t("quiz.keyboardHint")}
            </p>
            <div className="flex justify-between gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={onPrevious}
                >
                    {t("quiz.previous")}
                </Button>
                <Button type="button" onClick={onNext}>
                    {last ? t("quiz.reviewAnswers") : t("next")}
                </Button>
            </div>
        </section>
    );
});
