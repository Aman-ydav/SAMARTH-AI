import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_ANSWERS = 100;

/* One answered question as the learner saw it. The explanation stays out of reads unless asked for (DB-11): the list of
   attempts never needs it, the attempt detail adds it with `select("+answers.explanation")`. */
const answerRecordSchema = new mongoose.Schema(
    {
        questionId: { type: String, required: true, trim: true, maxlength: 64 },
        questionText: { type: String, trim: true, maxlength: 500 },
        selectedOptionIndex: { type: Number, required: true, min: 0, max: 5 },
        isCorrect: { type: Boolean, required: true },
        correctOptionIndex: { type: Number, required: true, min: 0, max: 5 },
        explanation: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
            select: false,
        },
    },
    { _id: false, timestamps: { createdAt: false, updatedAt: false } }
);

const quizAttemptSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        quizId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Quiz",
        },
        answers: {
            type: [answerRecordSchema],
            validate: {
                validator: (answers) => answers.length <= MAX_ANSWERS,
                message: "An attempt holds at most 100 answers.",
            },
        },
        scorePercent: { type: Number, required: true, min: 0, max: 100 },
        passed: { type: Boolean, required: true },
        feedback: { type: String, trim: true, maxlength: 1000 },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true, collection: "quizAttempts" }
);

// Serves "my attempts" (newest first) and the attempt-limit window count for one quiz.
quizAttemptSchema.index(
    { userId: 1, quizId: 1, submittedAt: -1 },
    { name: "quizAttempts_userId_quizId_submittedAt" }
);
quizAttemptSchema.plugin(toJsonPlugin);

export const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
