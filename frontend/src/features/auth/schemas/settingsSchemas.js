import { z } from "zod";
import {
    changeEmailSchema,
    deleteAccountSchema,
    nameField,
    normalizeEmail,
} from "@/features/auth/schemas/authSchemas";

/** Profile fields the API accepts (`PUT /profile` takes only these three; role, email and status are never sent). */
export const PROFILE_LOCALES = Object.freeze(["en", "hi"]);
const TIMEZONE_MAX_LENGTH = 64;

/** Mirrors the server check: a time zone is valid when `Intl` accepts it. */
export function isValidTimeZone(value) {
    if (typeof value !== "string" || value.length === 0) return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

export const profileSchema = z.object({
    name: nameField,
    locale: z.enum(PROFILE_LOCALES, "validation:locale.invalid"),
    timezone: z
        .string("validation:timezone.required")
        .trim()
        .min(1, "validation:timezone.required")
        .max(TIMEZONE_MAX_LENGTH, "validation:timezone.invalid")
        .refine(isValidTimeZone, "validation:timezone.invalid"),
});

/** Only the fields that differ from the saved profile, so a no-op save sends nothing (EDGE-107). */
export function diffProfile(values, saved) {
    const patch = {};
    for (const field of ["name", "locale", "timezone"]) {
        if (values[field] !== saved[field]) patch[field] = values[field];
    }
    return patch;
}

/** Avatar pre-checks: the server stays the authority (magic bytes, EXIF stripping), these only save a round trip (MEDIA-08). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
]);
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(",");
const AVATAR_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

export const AVATAR_PROBLEMS = Object.freeze({
    empty: "validation:avatar.empty",
    type: "validation:avatar.type",
    tooLarge: "validation:avatar.tooLarge",
    mismatch: "validation:avatar.mismatch",
});

/** Returns an i18n key for the first problem, or null when the file may be uploaded. */
export function validateAvatarFile(file) {
    if (!file || typeof file.size !== "number") return AVATAR_PROBLEMS.empty;
    if (file.size === 0) return AVATAR_PROBLEMS.empty;
    if (
        !AVATAR_MIME_TYPES.includes(file.type) ||
        !AVATAR_EXTENSION.test(String(file.name ?? ""))
    )
        return AVATAR_PROBLEMS.type;
    if (file.size > AVATAR_MAX_BYTES) return AVATAR_PROBLEMS.tooLarge;
    return null;
}

const startsWith = (bytes, signature, offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);

/** Image type named by the first bytes of a file (JPEG, PNG or WebP), or null for anything else. */
export function sniffImageType(bytes) {
    if (!bytes || bytes.length < 12) return null;
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        return "image/png";
    if (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    )
        return "image/webp";
    return null;
}

/**
 * Reads the first bytes of the file and checks they match the claimed type (a renamed file fails here instead of after the
 * upload). Browsers without `Blob.arrayBuffer` skip the check; the server always repeats it.
 */
export async function checkAvatarSignature(file) {
    if (typeof file?.slice !== "function") return null;
    const head = file.slice(0, 12);
    if (typeof head.arrayBuffer !== "function") return null;
    const bytes = new Uint8Array(await head.arrayBuffer());
    return sniffImageType(bytes) === file.type
        ? null
        : AVATAR_PROBLEMS.mismatch;
}

/** New-email form. Google-only accounts prove themselves with a Google credential instead of a password. */
export function buildChangeEmailFormSchema(
    currentEmail,
    { requiresPassword = true } = {}
) {
    const base = requiresPassword
        ? changeEmailSchema
        : changeEmailSchema.pick({ newEmail: true });
    return base.superRefine((data, ctx) => {
        if (normalizeEmail(data.newEmail) === normalizeEmail(currentEmail))
            ctx.addIssue({
                code: "custom",
                path: ["newEmail"],
                message: "validation:email.sameAsCurrent",
            });
    });
}

/** Delete-account form: the typed phrase must match, plus the current password for accounts that have one. */
export function buildDeleteAccountFormSchema(
    phrase,
    { requiresPassword = true } = {}
) {
    const confirmation = z
        .string("validation:confirmPhrase.mismatch")
        .refine(
            (value) =>
                value.trim().toLocaleUpperCase() === phrase.toLocaleUpperCase(),
            "validation:confirmPhrase.mismatch"
        );
    return requiresPassword
        ? deleteAccountSchema.extend({ confirmation })
        : z.object({ confirmation });
}
