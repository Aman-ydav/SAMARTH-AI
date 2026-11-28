import mongoose from "mongoose";
import { toJsonPlugin } from "#db/toJsonPlugin.js";

const MAX_QUESTIONS = 100;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/* Embedded question: the correct answer and the explanation never leave the database with the quiz (DB-11); the attempt
   service asks for them explicitly with `select("+questions.correctOptionIndex +questions.explanation")`. */
const questionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true, maxlength: 64 },
        question: { type: String, required: true, trim: true, maxlength: 500 },
        options: {
            type: [
                { type: String, required: true, trim: true, maxlength: 300 },
            ],
            validate: {
                validator: (options) =>
                    options.length >= MIN_OPTIONS &&
                    options.length <= MAX_OPTIONS,
                message: "A question needs two to six options.",
            },
        },
        correctOptionIndex: {
            type: Number,
            required: true,
            min: 0,
            max: MAX_OPTIONS - 1,
            select: false,
        },
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

const quizSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, trim: true, maxlength: 64 },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        domain: { type: String, required: true, trim: true, maxlength: 80 },
        competencyId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64,
            ref: "Competency",
        },
        level: { type: Number, required: true, min: 1, max: 5 },
        timeLimitMinutes: { type: Number, default: 15, min: 1, max: 240 },
        passingScorePercent: { type: Number, default: 70, min: 1, max: 100 },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        questions: {
            type: [questionSchema],
            validate: {
                validator: (questions) => questions.length <= MAX_QUESTIONS,
                message: "A quiz holds at most 100 questions.",
            },
        },
    },
    { timestamps: true, collection: "quizzes" }
);

// serves: the quiz list filtered by competency
quizSchema.index({ competencyId: 1 }, { name: "quizzes_competencyId" });
quizSchema.plugin(toJsonPlugin);

export const Quiz = mongoose.model("Quiz", quizSchema);
