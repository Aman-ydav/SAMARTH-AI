import { describe, it, expect } from "vitest";
import { getQuizzes, getQuizForAttempt } from "./assessment.service.js";

describe("Assessment & Quiz Service", () => {
    it("lists available quizzes with domain and question counts", async () => {
        const quizzes = await getQuizzes();
        expect(quizzes.length).toBeGreaterThan(0);

        const first = quizzes[0];
        expect(first.id).toBeDefined();
        expect(first.passingScorePercent).toBeGreaterThan(0);
        expect(first.questionCount).toBeGreaterThan(0);
    });

    it("sanitizes questions for attempts by concealing answers and explanations", async () => {
        const quiz = await getQuizForAttempt("quiz_s02_level3");
        expect(quiz.id).toBe("quiz_s02_level3");
        expect(quiz.questions.length).toBeGreaterThan(0);

        const q1 = quiz.questions[0];
        expect(q1.question).toBeDefined();
        expect(q1.options.length).toBe(4);
        // Sensitive fields must NOT be present
        expect(q1.correctOptionIndex).toBeUndefined();
        expect(q1.explanation).toBeUndefined();
    });
});
