import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Quiz, QuizAttempt } from "./quiz.model.js";
import { UserCompetency } from "../competency/competency.model.js";
import { ApiError } from "#utils/ApiError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_DIR = path.resolve(__dirname, "../../seed/data");

const isDbConnected = () => mongoose.connection.readyState === 1;

async function loadFallbackQuizzes() {
    try {
        const filePath = path.join(SEED_DATA_DIR, "quizzes.json");
        const data = await readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getQuizzes({ competencyId, domain } = {}) {
    let list = [];
    if (isDbConnected()) {
        try {
            list = await Quiz.find().lean();
        } catch {
            list = [];
        }
    }
    if (!list || list.length === 0) {
        list = await loadFallbackQuizzes();
    }

    let results = list.map((q) => ({
        id: q._id || q.id,
        title: q.title,
        domain: q.domain,
        competencyId: q.competencyId,
        level: q.level,
        timeLimitMinutes: q.timeLimitMinutes,
        passingScorePercent: q.passingScorePercent,
        description: q.description,
        questionCount: q.questions?.length || 0,
    }));

    if (competencyId) {
        results = results.filter((q) => q.competencyId.toLowerCase() === competencyId.toLowerCase());
    }
    if (domain) {
        results = results.filter((q) => q.domain.toLowerCase() === domain.toLowerCase());
    }

    return results;
}

export async function getQuizForAttempt(quizId) {
    let quiz = null;
    if (isDbConnected()) {
        try {
            quiz = await Quiz.findById(quizId).lean();
        } catch {
            quiz = null;
        }
    }
    if (!quiz) {
        const fallbacks = await loadFallbackQuizzes();
        quiz = fallbacks.find((q) => (q._id || q.id) === quizId);
    }
    if (!quiz) {
        throw ApiError.notFound("QUIZ_NOT_FOUND", `Quiz '${quizId}' not found`);
    }

    // Return sanitized questions WITHOUT correctOptionIndex or explanation
    const safeQuestions = quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
    }));

    return {
        id: quiz._id || quiz.id,
        title: quiz.title,
        domain: quiz.domain,
        competencyId: quiz.competencyId,
        level: quiz.level,
        timeLimitMinutes: quiz.timeLimitMinutes,
        passingScorePercent: quiz.passingScorePercent,
        description: quiz.description,
        questions: safeQuestions,
    };
}

export async function submitQuizAttempt(userId, quizId, userAnswers) {
    if (!Array.isArray(userAnswers)) {
        throw ApiError.badRequest("INVALID_ANSWERS", "Answers must be an array of { questionId, selectedOptionIndex }");
    }

    // Load full quiz with answers
    let fullQuiz = await Quiz.findById(quizId).select("+questions.correctOptionIndex +questions.explanation").lean();
    if (!fullQuiz) {
        const fallbacks = await loadFallbackQuizzes();
        fullQuiz = fallbacks.find((q) => (q._id || q.id) === quizId);
    }
    if (!fullQuiz) {
        throw ApiError.notFound("QUIZ_NOT_FOUND", `Quiz '${quizId}' not found`);
    }

    const questionMap = new Map();
    for (const q of fullQuiz.questions) {
        questionMap.set(q.id, q);
    }

    let correctCount = 0;
    const answerRecords = [];

    for (const ans of userAnswers) {
        const q = questionMap.get(ans.questionId);
        if (!q) continue;

        const isCorrect = Number(ans.selectedOptionIndex) === Number(q.correctOptionIndex);
        if (isCorrect) correctCount++;

        answerRecords.push({
            questionId: q.id,
            questionText: q.question,
            selectedOptionIndex: Number(ans.selectedOptionIndex),
            correctOptionIndex: q.correctOptionIndex,
            isCorrect,
            explanation: q.explanation,
        });
    }

    const totalQuestions = fullQuiz.questions.length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePercent >= fullQuiz.passingScorePercent;

    let feedback = "";
    if (passed) {
        feedback = `Outstanding performance! You scored ${scorePercent}%, exceeding the ${fullQuiz.passingScorePercent}% threshold for Level ${fullQuiz.level} proficiency in ${fullQuiz.competencyId}.`;
    } else {
        feedback = `You scored ${scorePercent}% (required: ${fullQuiz.passingScorePercent}%). Review the questions and recommendations below to strengthen your conceptual understanding before re-attempting.`;
    }

    const attempt = await QuizAttempt.create({
        userId,
        quizId: fullQuiz._id || fullQuiz.id,
        answers: answerRecords,
        scorePercent,
        passed,
        feedback,
    });

    let competencyUpdated = false;
    let newLevel = 0;

    // Competency Loop Closure: If passed, upgrade user's competency level
    if (passed) {
        const existing = await UserCompetency.findOne({ userId, competencyId: fullQuiz.competencyId });
        newLevel = Math.max(existing ? existing.currentLevel : 0, fullQuiz.level);

        await UserCompetency.findOneAndUpdate(
            { userId, competencyId: fullQuiz.competencyId },
            {
                $set: {
                    currentLevel: newLevel,
                    lastAssessedAt: new Date(),
                    confidenceScore: 0.9,
                },
                $push: {
                    evidence: {
                        type: "quiz_attempt",
                        sourceId: String(attempt._id),
                        score: scorePercent,
                        notes: `Certified Level ${newLevel} via Diagnostic Assessment (${scorePercent}%)`,
                        earnedAt: new Date(),
                    },
                },
            },
            { upsert: true, new: true }
        );
        competencyUpdated = true;
    }

    return {
        id: String(attempt._id),
        quizId: fullQuiz._id || fullQuiz.id,
        quizTitle: fullQuiz.title,
        competencyId: fullQuiz.competencyId,
        scorePercent,
        passingScorePercent: fullQuiz.passingScorePercent,
        passed,
        feedback,
        correctCount,
        totalQuestions,
        competencyUpdated,
        newLevel,
        answerReview: answerRecords,
        submittedAt: attempt.submittedAt,
    };
}

export async function getUserAttempts(userId) {
    const attempts = await QuizAttempt.find({ userId }).sort({ submittedAt: -1 }).lean();
    return attempts.map((a) => ({
        id: a._id || a.id,
        quizId: a.quizId,
        scorePercent: a.scorePercent,
        passed: a.passed,
        feedback: a.feedback,
        submittedAt: a.submittedAt,
    }));
}

export async function getAttemptById(userId, attemptId) {
    const attempt = await QuizAttempt.findOne({ _id: attemptId, userId }).lean();
    if (!attempt) {
        throw ApiError.notFound("ATTEMPT_NOT_FOUND", `Attempt '${attemptId}' not found`);
    }
    return attempt;
}
