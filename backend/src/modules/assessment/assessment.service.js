import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import {
    MAX_EVIDENCE_ENTRIES,
    UserCompetency,
} from "../competency/userCompetency.model.js";
import {
    ASSESSMENT_LIMITS,
    QUIZ_ATTEMPT_LIMIT,
} from "./assessment.constants.js";
import { Quiz } from "./quiz.model.js";
import { QuizAttempt } from "./quizAttempt.model.js";

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
            list = await Quiz.find().limit(ASSESSMENT_LIMITS.listMax).lean();
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
        results = results.filter(
            (q) => q.competencyId.toLowerCase() === competencyId.toLowerCase()
        );
    }
    if (domain) {
        results = results.filter(
            (q) => q.domain.toLowerCase() === domain.toLowerCase()
        );
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
        throw ApiError.notFound(ERROR_CODES.QUIZ_NOT_FOUND);
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

/** The quiz with its answer key, for scoring only. The key never goes back to the client before the attempt is saved. */
async function loadQuizWithAnswers(quizId) {
    let quiz = null;
    if (isDbConnected()) {
        quiz = await Quiz.findById(quizId)
            .select("+questions.correctOptionIndex +questions.explanation")
            .lean();
    }
    if (!quiz) {
        const fallbacks = await loadFallbackQuizzes();
        quiz = fallbacks.find((q) => (q._id || q.id) === quizId);
    }
    if (!quiz) {
        throw ApiError.notFound(ERROR_CODES.QUIZ_NOT_FOUND);
    }
    return quiz;
}

const invalidAnswers = (message) =>
    ApiError.badRequest(ERROR_CODES.INVALID_ANSWERS, {
        errors: [{ field: "answers", message }],
    });

/**
 * One answer per question, only for questions of this quiz, each option inside the question's own options. Counting the same
 * question twice would let a learner reach a pass by repeating one right answer, so a repeat is refused, not ignored.
 */
function checkAnswers(questionMap, userAnswers) {
    const seen = new Set();
    for (const answer of userAnswers) {
        const question = questionMap.get(answer.questionId);
        if (!question) throw invalidAnswers("Unknown question");
        if (seen.has(answer.questionId))
            throw invalidAnswers("Each question can be answered once");
        if (answer.selectedOptionIndex >= question.options.length)
            throw invalidAnswers("Option is out of range");
        seen.add(answer.questionId);
    }
}

/** At most `maxAttempts` attempts per quiz in any rolling window; the oldest one in the window decides when a slot frees. */
async function assertWithinAttemptLimit(userId, quizId) {
    const { maxAttempts, windowMs } = QUIZ_ATTEMPT_LIMIT;
    const now = Date.now();
    const recent = await QuizAttempt.find({
        userId,
        quizId,
        submittedAt: { $gte: new Date(now - windowMs) },
    })
        .sort({ submittedAt: 1 })
        .limit(maxAttempts)
        .select("submittedAt")
        .lean();
    if (recent.length < maxAttempts) return;
    const frees = recent[0].submittedAt.getTime() + windowMs;
    throw ApiError.tooManyRequests(ERROR_CODES.QUIZ_ATTEMPT_LIMIT, {
        retryAfterSec: Math.max(1, Math.ceil((frees - now) / 1000)),
    });
}

export async function submitQuizAttempt(userId, quizId, userAnswers) {
    const fullQuiz = await loadQuizWithAnswers(quizId);
    const savedQuizId = fullQuiz._id || fullQuiz.id;

    const questionMap = new Map(fullQuiz.questions.map((q) => [q.id, q]));
    checkAnswers(questionMap, userAnswers);
    await assertWithinAttemptLimit(userId, savedQuizId);

    let correctCount = 0;
    const answerRecords = userAnswers.map((answer) => {
        const q = questionMap.get(answer.questionId);
        const isCorrect = answer.selectedOptionIndex === q.correctOptionIndex;
        if (isCorrect) correctCount++;
        return {
            questionId: q.id,
            questionText: q.question,
            selectedOptionIndex: answer.selectedOptionIndex,
            correctOptionIndex: q.correctOptionIndex,
            isCorrect,
            explanation: q.explanation,
        };
    });

    const totalQuestions = fullQuiz.questions.length;
    const scorePercent =
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;
    const passed = scorePercent >= fullQuiz.passingScorePercent;

    const feedback = passed
        ? `Outstanding performance! You scored ${scorePercent}%, exceeding the ${fullQuiz.passingScorePercent}% threshold for Level ${fullQuiz.level} proficiency in ${fullQuiz.competencyId}.`
        : `You scored ${scorePercent}% (required: ${fullQuiz.passingScorePercent}%). Review the questions and recommendations below to strengthen your conceptual understanding before re-attempting.`;

    const attempt = await QuizAttempt.create({
        userId,
        quizId: savedQuizId,
        answers: answerRecords,
        scorePercent,
        passed,
        feedback,
    });

    let competencyUpdated = false;
    let newLevel = 0;

    // Competency loop closure: a pass raises the level, never lowers it. `$max` makes that one atomic step, so two attempts
    // finishing together cannot overwrite a higher level with a lower one.
    if (passed) {
        const updated = await UserCompetency.findOneAndUpdate(
            { userId, competencyId: fullQuiz.competencyId },
            {
                $max: { currentLevel: fullQuiz.level },
                $set: { lastAssessedAt: new Date(), confidenceScore: 0.9 },
                $push: {
                    evidence: {
                        $each: [
                            {
                                type: "quiz_attempt",
                                sourceId: String(attempt._id),
                                score: scorePercent,
                                notes: `Passed the Level ${fullQuiz.level} quiz (${scorePercent}%)`,
                                earnedAt: new Date(),
                            },
                        ],
                        $slice: -MAX_EVIDENCE_ENTRIES,
                    },
                },
            },
            { upsert: true, returnDocument: "after" }
        );
        newLevel = updated.currentLevel;
        competencyUpdated = true;
    }

    return {
        id: String(attempt._id),
        quizId: savedQuizId,
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
    const attempts = await QuizAttempt.find({ userId })
        .select("quizId scorePercent passed feedback submittedAt")
        .sort({ submittedAt: -1 })
        .limit(ASSESSMENT_LIMITS.listMax)
        .lean();
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
    // Scoped by owner: someone else's attempt answers 404, exactly like a missing one (AUTH-62).
    const attempt = await QuizAttempt.findOne({ _id: attemptId, userId })
        .select("+answers.explanation")
        .lean();
    if (!attempt) {
        throw ApiError.notFound(ERROR_CODES.ATTEMPT_NOT_FOUND);
    }
    return attempt;
}
