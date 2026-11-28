import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const questionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        question: { type: String, required: true, trim: true },
        options: [{ type: String, required: true, trim: true }],
        correctOptionIndex: { type: Number, required: true, select: false }, // protected from direct leak
        explanation: { type: String, required: true, select: false },
    },
    { _id: false }
);

const quizSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        domain: { type: String, required: true, trim: true },
        competencyId: { type: String, required: true, ref: "Competency", index: true },
        level: { type: Number, required: true, min: 1, max: 5 },
        timeLimitMinutes: { type: Number, default: 15 },
        passingScorePercent: { type: Number, default: 70 },
        description: { type: String, required: true, trim: true },
        questions: [questionSchema],
    },
    { timestamps: true }
);

quizSchema.plugin(toJsonPlugin);

const answerRecordSchema = new mongoose.Schema(
    {
        questionId: { type: String, required: true },
        selectedOptionIndex: { type: Number, required: true },
        isCorrect: { type: Boolean, required: true },
        correctOptionIndex: { type: Number, required: true },
        explanation: { type: String, required: true },
    },
    { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        quizId: { type: String, ref: "Quiz", required: true },
        answers: [answerRecordSchema],
        scorePercent: { type: Number, required: true, min: 0, max: 100 },
        passed: { type: Boolean, required: true },
        feedback: { type: String, trim: true },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

quizAttemptSchema.plugin(toJsonPlugin);

export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
