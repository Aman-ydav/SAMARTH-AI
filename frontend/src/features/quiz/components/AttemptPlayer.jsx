import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { generatePath, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Progress } from "@/components/ui/progress";
import { ConfirmStep } from "@/features/quiz/components/ConfirmStep";
import { QuestionStep } from "@/features/quiz/components/QuestionStep";
import { useCountdown } from "@/features/quiz/hooks/useCountdown";
import {
    answerSet,
    attemptStarted,
    questionChanged,
    selectQuiz,
    submitQuiz,
} from "@/features/quiz/slice/quizSlice";
import { STATUS } from "@/lib/asyncState";
import { formatCountdown } from "@/lib/format";
import { PATHS } from "@/lib/paths";

const WARN_AT = [60, 10];

/**
 * The quiz in progress: timer from `timeLimitMinutes` (auto-submits at zero), one question per screen, `n`/`p` keys,
 * a confirmation step, and focus moved to the new heading on every step change.
 */
export function AttemptPlayer({ quiz }) {
    const { t } = useTranslation("common");
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { session, submit, lastResultId } = useAppSelector(selectQuiz);
    const [confirming, setConfirming] = useState(false);
    const [deadline] = useState(() =>
        quiz.timeLimitMinutes > 0
            ? Date.now() + quiz.timeLimitMinutes * 60_000
            : null
    );
    const headingRef = useRef(null);
    const questions = quiz.questions ?? [];
    const index = Math.min(session.current, Math.max(0, questions.length - 1));
    const question = questions[index];

    useEffect(() => {
        dispatch(attemptStarted(quiz.id));
    }, [dispatch, quiz.id]);

    const send = () => dispatch(submitQuiz({ quizId: quiz.id }));
    const remaining = useCountdown(deadline, send);

    useEffect(() => {
        headingRef.current?.focus();
    }, [index, confirming]);

    useEffect(() => {
        if (submit.status === STATUS.SUCCEEDED && lastResultId) {
            navigate(generatePath(PATHS.result, { id: lastResultId }), {
                replace: true,
            });
        }
    }, [submit.status, lastResultId, navigate]);

    const go = (next) => {
        if (next < 0) return;
        if (next >= questions.length) {
            setConfirming(true);
            return;
        }
        setConfirming(false);
        dispatch(questionChanged(next));
    };

    const onKeyDown = (event) => {
        if (confirming || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "n") go(index + 1);
        if (event.key === "p") go(index - 1);
    };

    if (!question) {
        return <p className="text-muted-foreground">{t("quiz.noQuestions")}</p>;
    }

    const warning = WARN_AT.includes(remaining)
        ? t("quiz.timeWarning", { time: formatCountdown(remaining) })
        : "";

    return (
        <div className="flex flex-col gap-5" onKeyDown={onKeyDown}>
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    {t("quiz.questionOf", {
                        current: confirming ? questions.length : index + 1,
                        total: questions.length,
                    })}
                </p>
                {remaining !== null && (
                    <p
                        role="timer"
                        aria-live="off"
                        className="font-mono font-medium text-foreground"
                    >
                        <span className="sr-only">{t("quiz.timeLeft")}: </span>
                        {formatCountdown(remaining)}
                    </p>
                )}
            </div>
            <p role="status" className="sr-only">
                {warning}
            </p>
            <Progress
                value={
                    ((confirming ? questions.length : index + 1) /
                        questions.length) *
                    100
                }
                aria-label={t("quiz.progress")}
            />
            {confirming ? (
                <ConfirmStep
                    ref={headingRef}
                    questions={questions}
                    answers={session.answers}
                    submit={submit}
                    onBack={() => setConfirming(false)}
                    onGoTo={go}
                    onSubmit={send}
                />
            ) : (
                <QuestionStep
                    ref={headingRef}
                    question={question}
                    index={index}
                    total={questions.length}
                    selected={session.answers[question.id]}
                    onSelect={(optionIndex) =>
                        dispatch(
                            answerSet({ questionId: question.id, optionIndex })
                        )
                    }
                    onPrevious={() => go(index - 1)}
                    onNext={() => go(index + 1)}
                />
            )}
        </div>
    );
}
