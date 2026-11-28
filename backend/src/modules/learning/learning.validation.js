import { z } from "zod";
import { paginationQueryShape } from "#utils/pagination.js";
import { LEARNING_LIMITS } from "./learning.constants.js";

const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

const slug = z
    .string()
    .min(1)
    .max(LEARNING_LIMITS.idMaxLength)
    .regex(SLUG_PATTERN);

export const courseIdParams = z.object({ id: slug });

/** `GET /learning/courses`: filters plus standard paging. Unknown keys are refused by `validate` (BE-23). */
export const listCoursesQuery = z.object({
    ...paginationQueryShape,
    domain: z
        .string()
        .trim()
        .min(1)
        .max(LEARNING_LIMITS.domainMaxLength)
        .optional(),
    competencyId: slug.optional(),
    provider: z
        .string()
        .trim()
        .min(1)
        .max(LEARNING_LIMITS.providerMaxLength)
        .optional(),
    search: z
        .string()
        .trim()
        .min(1)
        .max(LEARNING_LIMITS.searchMaxLength)
        .optional(),
});

export const emptyQuery = z.object({});

/** `GET /learning/me/recommendations` and `/me/learning-path`: which role profile to compare against. */
export const targetRoleQuery = z.object({ targetRole: slug.optional() });

export const enrolBody = z.object({ courseId: slug });

/** The learner reports how far they are; the service derives the status from it. */
export const progressBody = z.object({
    progressPercent: z.number().int().min(0).max(100),
});
