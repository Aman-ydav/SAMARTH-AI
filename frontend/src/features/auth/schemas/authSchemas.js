import { z } from "zod";
import { codePointLength, utf8ByteLength } from "@/lib/forms";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;

const MIN_PERSONAL_PART = 3;

/* A small mirror of the server denylist: the server stays authoritative (PASSWORD_POLICY). */
const COMMON_PASSWORDS = new Set([
    "password",
    "password1",
    "password12",
    "password123",
    "1234567890",
    "12345678910",
    "123456789012",
    "qwertyuiop",
    "qwerty123456",
    "1q2w3e4r5t",
    "iloveyou123",
    "letmein1234",
    "welcome1234",
    "admin12345",
    "administrator",
    "abcdefghij",
    "abc1234567",
    "passw0rd123",
    "samarthai",
    "samarth123",
    "samarth@123",
    "india12345",
    "india@12345",
]);

const MESSAGES = {
    required: "validation:required",
    nameRequired: "validation:name.required",
    nameShort: "validation:name.tooShort",
    nameLong: "validation:name.tooLong",
    emailRequired: "validation:email.required",
    emailInvalid: "validation:email.invalid",
    emailLong: "validation:email.tooLong",
    passwordRequired: "validation:password.required",
    passwordShort: "validation:password.tooShort",
    passwordLongBytes: "validation:password.tooLongBytes",
    passwordCommon: "validation:password.common",
    passwordEmail: "validation:password.containsEmail",
    passwordName: "validation:password.containsName",
    passwordSame: "validation:password.sameAsCurrent",
    confirmRequired: "validation:confirmPassword.required",
    confirmMismatch: "validation:confirmPassword.mismatch",
    terms: "validation:terms.required",
    token: "validation:token.required",
};

export const normalizeEmail = (value) =>
    String(value ?? "")
        .trim()
        .normalize("NFKC")
        .toLowerCase();

const emailLocalPart = (email) => normalizeEmail(email).split("@")[0] ?? "";

function nameParts(name) {
    return String(name ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .split(/\s+/)
        .filter((part) => codePointLength(part) >= MIN_PERSONAL_PART);
}

/**
 * Evaluates the client mirror of the password policy (doc 20 section 12) and returns one boolean per rule,
 * so forms can render a checklist and schemas can reuse the same decisions.
 */
export function evaluatePasswordPolicy(
    password,
    { email = "", name = "" } = {}
) {
    const value = typeof password === "string" ? password : "";
    const lower = value.normalize("NFKC").toLowerCase();
    const local = emailLocalPart(email);
    const containsEmail =
        codePointLength(local) >= MIN_PERSONAL_PART && lower.includes(local);
    const containsName = nameParts(name).some((part) => lower.includes(part));
    return {
        minLength: codePointLength(value) >= PASSWORD_MIN_LENGTH,
        maxBytes: utf8ByteLength(value) <= PASSWORD_MAX_BYTES,
        notCommon: !COMMON_PASSWORDS.has(lower),
        noPersonal: !containsEmail && !containsName,
        containsEmail,
        containsName,
    };
}

export const emailField = z
    .string(MESSAGES.emailRequired)
    .transform(normalizeEmail)
    .pipe(
        z
            .string()
            .min(1, MESSAGES.emailRequired)
            .max(EMAIL_MAX_LENGTH, MESSAGES.emailLong)
            .pipe(z.email(MESSAGES.emailInvalid))
    );

export const nameField = z
    .string(MESSAGES.nameRequired)
    .transform((value) => value.trim().normalize("NFKC"))
    .pipe(
        z.string().superRefine((value, ctx) => {
            const length = codePointLength(value);
            if (length === 0)
                ctx.addIssue({
                    code: "custom",
                    message: MESSAGES.nameRequired,
                });
            else if (length < NAME_MIN_LENGTH)
                ctx.addIssue({ code: "custom", message: MESSAGES.nameShort });
            else if (length > NAME_MAX_LENGTH)
                ctx.addIssue({ code: "custom", message: MESSAGES.nameLong });
        })
    );

/** Password being set (register, reset, change, invite): length in characters, size in UTF-8 bytes. */
const newPasswordField = z
    .string(MESSAGES.passwordRequired)
    .min(1, MESSAGES.passwordRequired)
    .refine(
        (value) =>
            value.length === 0 || codePointLength(value) >= PASSWORD_MIN_LENGTH,
        MESSAGES.passwordShort
    )
    .refine(
        (value) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES,
        MESSAGES.passwordLongBytes
    )
    .refine(
        (value) => !COMMON_PASSWORDS.has(value.normalize("NFKC").toLowerCase()),
        MESSAGES.passwordCommon
    );

/** Password being typed to prove identity: only presence and the hard byte ceiling are checked. */
export const currentPasswordField = z
    .string(MESSAGES.passwordRequired)
    .min(1, MESSAGES.passwordRequired)
    .refine(
        (value) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES,
        MESSAGES.passwordLongBytes
    );

const confirmField = z
    .string(MESSAGES.confirmRequired)
    .min(1, MESSAGES.confirmRequired);
const tokenField = z.string(MESSAGES.token).min(1, MESSAGES.token);

const confirmMatches = (field) => (data, ctx) => {
    if (data.confirmPassword !== data[field])
        ctx.addIssue({
            code: "custom",
            path: ["confirmPassword"],
            message: MESSAGES.confirmMismatch,
        });
};

function checkPersonalData(data, ctx) {
    const result = evaluatePasswordPolicy(data.password, {
        email: data.email,
        name: data.name,
    });
    if (result.containsEmail)
        ctx.addIssue({
            code: "custom",
            path: ["password"],
            message: MESSAGES.passwordEmail,
        });
    else if (result.containsName)
        ctx.addIssue({
            code: "custom",
            path: ["password"],
            message: MESSAGES.passwordName,
        });
}

export const loginSchema = z.object({
    email: emailField,
    password: currentPasswordField,
    rememberMe: z.boolean().default(false),
    reactivate: z.boolean().optional(),
});

export const registerSchema = z
    .object({
        name: nameField,
        email: emailField,
        password: newPasswordField,
        confirmPassword: confirmField,
        acceptTerms: z.literal(true, MESSAGES.terms),
    })
    .superRefine((data, ctx) => {
        confirmMatches("password")(data, ctx);
        checkPersonalData(data, ctx);
    });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resendVerificationSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
    .object({ newPassword: newPasswordField, confirmPassword: confirmField })
    .superRefine(confirmMatches("newPassword"));

export const changePasswordSchema = z
    .object({
        currentPassword: currentPasswordField,
        newPassword: newPasswordField,
        confirmPassword: confirmField,
    })
    .superRefine((data, ctx) => {
        confirmMatches("newPassword")(data, ctx);
        if (data.currentPassword && data.currentPassword === data.newPassword)
            ctx.addIssue({
                code: "custom",
                path: ["newPassword"],
                message: MESSAGES.passwordSame,
            });
    });

export const acceptInviteSchema = z
    .object({
        name: nameField,
        password: newPasswordField,
        confirmPassword: confirmField,
    })
    .superRefine((data, ctx) => {
        confirmMatches("password")(data, ctx);
        checkPersonalData(data, ctx);
    });

export const changeEmailSchema = z.object({
    newEmail: emailField,
    currentPassword: currentPasswordField,
});

export const deleteAccountSchema = z.object({
    currentPassword: currentPasswordField,
});

export const oneTimeTokenSchema = z.object({ token: tokenField });

/** Strips UI-only fields before a body goes to the API. */
export const toRegisterBody = ({ name, email, password, acceptTerms }) => ({
    name,
    email,
    password,
    acceptTerms,
});
export const toLoginBody = ({ email, password, rememberMe, reactivate }) => ({
    email,
    password,
    rememberMe: Boolean(rememberMe),
    ...(reactivate ? { reactivate: true } : {}),
});
