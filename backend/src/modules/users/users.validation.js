import { z } from "zod";
import { LOCALE_LIST } from "#constants/statuses.js";
import { hasControlCharacters } from "#utils/strings.js";

const isTimeZone = (value) => {
    try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

const name = z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100)
    .refine((value) => !hasControlCharacters(value), "Invalid characters");

/** `PUT /profile`: a partial update of the three editable preferences. Unknown keys (role, email, status...) are refused. */
export const updateProfileBody = z
    .strictObject({
        name,
        locale: z.enum(LOCALE_LIST),
        timezone: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .refine(isTimeZone, "Unknown time zone"),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required",
    });

export const emptyQuery = z.object({});
