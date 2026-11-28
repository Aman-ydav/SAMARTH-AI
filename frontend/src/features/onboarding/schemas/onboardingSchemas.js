import { z } from "zod";

export const MAX_RATED_COMPETENCIES = 12;
export const MAX_LEVEL = 5;

const text = (max) =>
    z
        .string()
        .trim()
        .min(1, "validation:required")
        .max(max, "validation:onboarding.tooLong");

/** Step 1: role and department. `yearsOfService` arrives as text from the input and leaves as an integer. */
export const roleStepSchema = z.object({
    designation: text(100),
    department: text(100),
    yearsOfService: z
        .string()
        .trim()
        .min(1, "validation:required")
        .regex(/^\d{1,2}$/, "validation:onboarding.years")
        .refine((value) => Number(value) <= 60, "validation:onboarding.years"),
    targetRole: text(100),
});

/** Step 2: ratings keyed by competency id, each an integer 0 to 5, at least one, at most 12. */
export const ratingsSchema = z
    .record(z.string(), z.number().int().min(0).max(MAX_LEVEL))
    .refine((value) => Object.keys(value).length >= 1, "no-ratings")
    .refine(
        (value) => Object.keys(value).length <= MAX_RATED_COMPETENCIES,
        "too-many"
    );

export const toRatingsPayload = (ratings) =>
    Object.entries(ratings).map(([competencyId, level]) => ({
        competencyId,
        level,
    }));

export const toProfilePayload = (profile) => ({
    designation: profile.designation.trim(),
    department: profile.department.trim(),
    yearsOfService: Number(profile.yearsOfService),
    targetRole: profile.targetRole.trim(),
});
