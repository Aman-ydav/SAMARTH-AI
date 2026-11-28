import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { AttemptPlayer } from "@/features/quiz/components/AttemptPlayer";
import { fetchQuiz, selectQuiz } from "@/features/quiz/slice/quizSlice";
import { STATUS } from "@/lib/asyncState";

/** Loads the quiz (always fresh, so a restart gets a new timer) and hands it to the player. */
export default function QuizAttemptPage() {
    const { t } = useTranslation("common");
    const { id } = useParams();
    const dispatch = useAppDispatch();
    const { detail } = useAppSelector(selectQuiz);
    const quiz = detail.quiz && String(detail.quiz.id) === id ? detail.quiz : null;
    const ready = quiz && detail.status === STATUS.SUCCEEDED;

    useEffect(() => {
        dispatch(fetchQuiz(id));
    }, [dispatch, id]);

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-2xl flex-col gap-5 focus:outline-none"
        >
            <h1 className="type-h2 text-foreground">
                {quiz?.title ?? t("quiz.detail.title")}
            </h1>
            {detail.status === STATUS.FAILED ? (
                <LoadErrorAlert
                    error={detail.error}
                    onRetry={() => dispatch(fetchQuiz(id))}
                />
            ) : ready ? (
                <AttemptPlayer key={quiz.id} quiz={quiz} />
            ) : (
                <Skeleton
                    className="h-64 w-full"
                    aria-busy="true"
                    aria-label={t("loading")}
                />
            )}
        </main>
    );
}
