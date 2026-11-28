import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, generatePath, useParams } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchQuiz, selectQuiz } from "@/features/quiz/slice/quizSlice";
import { STATUS } from "@/lib/asyncState";
import { PATHS } from "@/lib/paths";

/** Quiz overview before starting: time limit, question count, pass mark and the attempt rules. */
export default function QuizDetailPage() {
    const { t } = useTranslation("common");
    const { id } = useParams();
    const dispatch = useAppDispatch();
    const { detail } = useAppSelector(selectQuiz);
    const quiz = detail.quiz && String(detail.quiz.id) === id ? detail.quiz : null;

    useEffect(() => {
        dispatch(fetchQuiz(id));
    }, [dispatch, id]);

    let body;
    if (detail.status === STATUS.FAILED) {
        body = (
            <LoadErrorAlert
                error={detail.error}
                onRetry={() => dispatch(fetchQuiz(id))}
            />
        );
    } else if (!quiz) {
        body = (
            <Skeleton
                className="h-48 w-full"
                aria-busy="true"
                aria-label={t("loading")}
            />
        );
    } else {
        const facts = [
            ["questions", quiz.questions.length],
            ["time", quiz.timeLimitMinutes > 0 ? t("quiz.minutes", { count: quiz.timeLimitMinutes }) : t("quiz.noLimit")],
            ["passMark", `${quiz.passingScorePercent}%`],
        ];
        body = (
            <Card>
                <CardHeader>
                    <CardTitle>{quiz.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    {quiz.description && <p>{quiz.description}</p>}
                    <dl className="grid grid-cols-3 gap-3">
                        {facts.map(([key, value]) => (
                            <div key={key} className="flex flex-col">
                                <dt className="text-sm text-muted-foreground">
                                    {t(`quiz.detail.${key}`)}
                                </dt>
                                <dd className="font-medium">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="text-sm text-muted-foreground">
                        {t("quiz.detail.rules")}
                    </p>
                    <div>
                        <Button asChild>
                            <Link to={generatePath(PATHS.attempt, { id })}>
                                {t("quiz.detail.start")}
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-6 focus:outline-none"
        >
            <h1 className="type-h1 text-foreground">{t("quiz.detail.title")}</h1>
            {body}
        </main>
    );
}
