import { z } from "zod";
import { paginationQueryShape } from "#utils/pagination.js";
import { hasControlCharacters } from "#utils/strings.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const DOMAIN_PATTERN =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const name = z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => !hasControlCharacters(value), "Invalid characters");
const code = z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(CODE_PATTERN)
    .transform((value) => value.toLowerCase());
const domains = z
    .array(z.string().trim().toLowerCase().max(100).regex(DOMAIN_PATTERN))
    .max(20)
    .refine((items) => new Set(items).size === items.length);

const settings = z
    .object({
        allowSelfRegistration: z.boolean(),
        allowedEmailDomains: domains,
        requireEmailVerification: z.boolean(),
        allowGoogleLogin: z.boolean(),
    })
    .strict();

const partialSettings = z
    .object({
        allowSelfRegistration: z.boolean().optional(),
        allowedEmailDomains: domains.optional(),
        requireEmailVerification: z.boolean().optional(),
        allowGoogleLogin: z.boolean().optional(),
    })
    .strict();

export const organisationIdParams = z.object({
    id: z.string().regex(OBJECT_ID_PATTERN),
});

export const createOrganisationBody = z.object({
    name,
    code,
    settings: settings.optional(),
});

export const updateOrganisationBody = z
    .object({
        name: name.optional(),
        code: code.optional(),
        settings: partialSettings.optional(),
        expectedVersion: z.number().int().min(0),
    })
    .refine(
        ({ name: nextName, code: nextCode, settings: nextSettings }) =>
            nextName !== undefined ||
            nextCode !== undefined ||
            nextSettings !== undefined,
        { message: "At least one field must be updated" }
    );

export const listOrganisationsQuery = z.object({
    ...paginationQueryShape,
    status: z.enum(["active", "inactive"]).optional(),
    q: z.string().trim().min(1).max(64).optional(),
});
