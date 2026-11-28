import { z } from "zod";
import { COMPETENCY_LIMITS } from "./competency.constants.js";

const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

const slug = z
    .string()
    .min(1)
    .max(COMPETENCY_LIMITS.idMaxLength)
    .regex(SLUG_PATTERN);

export const roleIdParams = z.object({ id: slug });

export const emptyQuery = z.object({});

/** `GET /competencies/me/gaps`: which role profile to compare against; the default applies when absent. */
export const gapsQuery = z.object({ targetRole: slug.optional() });

/** One rating per competency, level 0 to 5. The service checks the ids against the framework and refuses repeats. */
export const selfAssessmentBody = z.object({
    ratings: z
        .array(
            z.object({
                competencyId: slug,
                level: z.number().int().min(0).max(5),
            })
        )
        .min(1)
        .max(COMPETENCY_LIMITS.maxRatings),
});
