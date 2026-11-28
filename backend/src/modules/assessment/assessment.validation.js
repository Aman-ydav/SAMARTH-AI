import { z } from "zod";
import { ASSESSMENT_LIMITS } from "./assessment.constants.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

const slug = z
    .string()
    .min(1)
    .max(ASSESSMENT_LIMITS.idMaxLength)
    .regex(SLUG_PATTERN);

export const quizIdParams = z.object({ id: slug });

export const attemptIdParams = z.object({
    attemptId: z.string().regex(OBJECT_ID_PATTERN),
});

/** `GET /assessment/quizzes`: optional filters. Unknown keys are refused by `validate` (BE-23). */
export const listQuizzesQuery = z.object({
    competencyId: slug.optional(),
    domain: z
        .string()
        .trim()
        .min(1)
        .max(ASSESSMENT_LIMITS.domainMaxLength)
        .optional(),
});

export const emptyQuery = z.object({});

/** One answer per question: the option is an index into the question's own options (the service checks the range). */
export const submitAttemptBody = z.object({
    answers: z
        .array(
            z.object({
                questionId: slug,
                selectedOptionIndex: z.number().int().min(0).max(5),
            })
        )
        .min(1)
        .max(ASSESSMENT_LIMITS.maxAnswers),
});
