import { z } from "zod";
import { hasControlCharacters } from "#utils/strings.js";

// Request schemas for /auth (BE-23). validate() makes them strict, so `role`, `orgId` or `status` in a body are refused.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254)
    .refine((value) => EMAIL_PATTERN.test(value), "Enter a valid email address")
    .refine((value) => !hasControlCharacters(value), "Invalid characters");

const name = z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100)
    .refine((value) => !hasControlCharacters(value), "Invalid characters");

// Passwords are never trimmed or normalised: spaces count. The policy (length, bytes, denylist) is enforced by the
// service as PASSWORD_POLICY; here only an absolute ceiling stops absurd payloads from reaching bcrypt.
const password = z.string().min(1, "Password is required").max(256);

// Tokens are checked by the service so that every kind of bad token gets the same generic error code (AUTH-52).
const token = z.string().min(1, "Token is required").max(512);
const credential = z.string().min(10).max(4096);
const optionalFlag = z.boolean().optional();

export const emptyBody = z.object({});
export const emptyQuery = z.object({});

export const registerBody = z.object({
    name,
    email,
    password,
    acceptTerms: z.literal(true, {
        error: "You must accept the terms and privacy policy",
    }),
});

export const verifyEmailBody = z.object({ token });
export const resendVerificationBody = z.object({ email });

export const loginBody = z.object({
    email,
    password,
    rememberMe: optionalFlag,
    reactivate: optionalFlag,
});

export const googleBody = z.object({
    credential,
    nonce: z.string().min(1).max(256).optional(),
    reactivate: optionalFlag,
});

export const unlinkGoogleBody = z.object({ credential });

export const forgotPasswordBody = z.object({ email });
export const tokenBody = z.object({ token });
export const resetPasswordBody = z.object({ token, newPassword: password });

// Sensitive actions need exactly one proof: the current password, or (Google-only accounts) a fresh Google credential.
const exactlyOneProof = (value) =>
    (value.currentPassword === undefined) !== (value.credential === undefined);
const proofMessage = {
    message: "Send either currentPassword or credential",
    path: ["currentPassword"],
};
const proof = {
    currentPassword: password.optional(),
    credential: credential.optional(),
};

export const changePasswordBody = z
    .object({ ...proof, newPassword: password })
    .refine(exactlyOneProof, proofMessage);

export const changeEmailBody = z
    .object({ ...proof, newEmail: email })
    .refine(exactlyOneProof, proofMessage);

export const deleteAccountBody = z
    .object(proof)
    .refine(exactlyOneProof, proofMessage);

export const acceptInviteBody = z.object({ token, name, password });

// The id format is checked by the service so a bad id answers 400 INVALID_ID, as doc 08 lists it.
export const sessionParams = z.object({ id: z.string().min(1).max(64) });
