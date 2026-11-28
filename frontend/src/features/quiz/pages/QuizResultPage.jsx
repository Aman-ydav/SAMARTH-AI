import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectQuiz } from "@/features/quiz/slice/quizSlice";
import { PATHS } from "@/lib/paths";

/** Shows exactly what the server returned for an attempt. No score is computed here. */
export default function QuizResultPage() {
    const { t } = useTranslation("common");
    const { id } = useParams();
    const result = useAppSelector((state) => selectQuiz(state).results[id]);
    const headingRef = useRef(null);

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    if (!result) {
        return (
            <main
                id="main-content"
                tabIndex={-1}
                className="flex flex-col items-start gap-4 focus:outline-none"
            >
                <h1 ref={headingRef} tabIndex={-1} className="type-h1 text-foreground">
                    {t("quiz.result.title")}
                </h1>
                <p className="text-muted-foreground">{t("quiz.result.missing")}</p>
                <Button asChild>
                    <Link to={PATHS.quizzes}>{t("quiz.backToQuizzes")}</Link>
                </Button>
            </main>
        );
    }

    const review = result.answerReview ?? [];
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col gap-6 focus:outline-none"
        >
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="type-h1 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                {t("quiz.result.title")}
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-3">
                        <span>{t("quiz.score", { score: result.scorePercent })}</span>
                        <Badge variant={result.passed ? "success" : "warning"}>
                            {result.passed ? t("quiz.passed") : t("quiz.notPassed")}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <p>
                        {t("quiz.result.correct", {
                            correct: result.correctCount,
                            total: result.totalQuestions,
                        })}
                    </p>
                    {result.feedback && (
                        <p className="text-muted-foreground">{result.feedback}</p>
                    )}
                    <p role="status" className="font-medium">
                        {result.competencyUpdated
                            ? t("quiz.result.levelUp", { level: result.newLevel })
                            : t("quiz.result.noChange")}
                    </p>
                </CardContent>
            </Card>
            {review.length > 0 && (
                <section aria-labelledby="quiz-review" className="flex flex-col gap-3">
                    <h2 id="quiz-review" className="type-h3 text-foreground">
                        {t("quiz.result.review")}
                    </h2>
                    <ol className="flex flex-col gap-3">
                        {review.map((item, index) => (
                            <li key={item.questionId}>
                                <Card>
                                    <CardContent className="flex flex-col gap-2">
                                        <p className="font-medium">
                                            {index + 1}. {item.questionText}
                                        </p>
                                        <Badge
                                            variant={item.isCorrect ? "success" : "destructive"}
                                            className="self-start"
                                        >
                                            {item.isCorrect
                                                ? t("quiz.result.right")
                                                : t("quiz.result.wrong")}
                                        </Badge>
                                        {item.explanation && (
                                            <p className="text-sm text-muted-foreground">
                                                {item.explanation}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
            <div>
                <Button asChild variant="outline">
                    <Link to={PATHS.quizzes}>{t("quiz.backToQuizzes")}</Link>
                </Button>
            </div>
        </main>
    );
}
