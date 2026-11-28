import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, generatePath } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { LoadErrorAlert } from "@/components/common/LoadErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    fetchMyAttempts,
    fetchQuizzes,
    selectQuiz,
} from "@/features/quiz/slice/quizSlice";
import { STATUS } from "@/lib/asyncState";
import { formatDate } from "@/lib/format";
import { PATHS } from "@/lib/paths";

/** Available quizzes plus the learner's previous attempts. */
export default function QuizzesPage() {
    const { t, i18n } = useTranslation("common");
    const dispatch = useAppDispatch();
    const { list, attempts } = useAppSelector(selectQuiz);
    const titles = useMemo(
        () => new Map(list.items.map((quiz) => [String(quiz.id), quiz.title])),
        [list.items]
    );
    const loading = list.status === STATUS.IDLE || list.status === STATUS.LOADING;

    useEffect(() => {
        dispatch(fetchQuizzes());
        dispatch(fetchMyAttempts());
    }, [dispatch]);

    let body;
    if (loading) {
        body = (
            <div
                className="grid gap-4 md:grid-cols-2"
                aria-busy="true"
                aria-label={t("loading")}
            >
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-40 w-full" />
                ))}
            </div>
        );
    } else if (list.status === STATUS.FAILED) {
        body = (
            <LoadErrorAlert
                error={list.error}
                onRetry={() => dispatch(fetchQuizzes())}
            />
        );
    } else if (list.items.length === 0) {
        body = <p className="text-muted-foreground">{t("quiz.empty")}</p>;
    } else {
        body = (
            <ul className="grid gap-4 md:grid-cols-2">
                {list.items.map((quiz) => (
                    <li key={quiz.id}>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>{quiz.title}</CardTitle>
                                <CardDescription>{quiz.domain}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2 text-sm">
                                <Badge variant="info">
                                    {t("quiz.questionCount", {
                                        count: quiz.questionCount,
                                    })}
                                </Badge>
                                {quiz.timeLimitMinutes > 0 && (
                                    <Badge variant="info">
                                        {t("quiz.minutes", {
                                            count: quiz.timeLimitMinutes,
                                        })}
                                    </Badge>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button asChild>
                                    <Link
                                        to={generatePath(PATHS.quizDetail, {
                                            id: String(quiz.id),
                                        })}
                                    >
                                        {t("quiz.open", { title: quiz.title })}
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-8 focus:outline-none"
        >
            <header className="flex flex-col gap-2">
                <h1 className="type-h1 text-foreground">{t("quiz.title")}</h1>
                <p className="max-w-prose text-muted-foreground">
                    {t("quiz.intro")}
                </p>
            </header>
            {body}
            <section aria-labelledby="quiz-history" className="flex flex-col gap-3">
                <h2 id="quiz-history" className="type-h3 text-foreground">
                    {t("quiz.history.title")}
                </h2>
                {attempts.status === STATUS.FAILED ? (
                    <LoadErrorAlert
                        error={attempts.error}
                        onRetry={() => dispatch(fetchMyAttempts())}
                    />
                ) : attempts.status !== STATUS.SUCCEEDED ? (
                    <Skeleton className="h-12 w-full" />
                ) : attempts.items.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t("quiz.history.empty")}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {attempts.items.map((attempt) => (
                            <li
                                key={attempt.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                            >
                                <span className="font-medium">
                                    {titles.get(String(attempt.quizId)) ??
                                        t("quiz.history.unknown")}
                                </span>
                                <span className="flex items-center gap-3 text-sm">
                                    <span>
                                        {t("quiz.score", {
                                            score: attempt.scorePercent,
                                        })}
                                    </span>
                                    <Badge
                                        variant={
                                            attempt.passed ? "success" : "warning"
                                        }
                                    >
                                        {attempt.passed
                                            ? t("quiz.passed")
                                            : t("quiz.notPassed")}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                        {formatDate(
                                            attempt.submittedAt,
                                            i18n.language
                                        )}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
