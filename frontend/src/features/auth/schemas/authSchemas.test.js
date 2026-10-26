import { describe, expect, it } from "vitest";
import {
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    acceptInviteSchema,
    changeEmailSchema,
    changePasswordSchema,
    deleteAccountSchema,
    evaluatePasswordPolicy,
    forgotPasswordSchema,
    loginSchema,
    normalizeEmail,
    oneTimeTokenSchema,
    registerSchema,
    resendVerificationSchema,
    resetPasswordSchema,
    toLoginBody,
    toRegisterBody,
} from "@/features/auth";
import { utf8ByteLength } from "@/lib/forms";

const messagesOf = (result) =>
    result.success ? [] : result.error.issues.map((issue) => issue.message);
const issuesFor = (result) => {
    const byField = {};
    if (!result.success)
        for (const issue of result.error.issues)
            (byField[issue.path[0]] ??= []).push(issue.message);
    return new Proxy(byField, { get: (target, field) => target[field] ?? [] });
};

const validRegister = {
    name: "Asha Verma",
    email: "asha.verma@example.test",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    acceptTerms: true,
};

describe("password byte boundary (R4, 72 UTF-8 bytes)", () => {
    const newPassword = (value) =>
        resetPasswordSchema.safeParse({
            newPassword: value,
            confirmPassword: value,
        });

    it("accepts exactly 72 ASCII bytes and rejects 73", () => {
        const prefix = "Zq9!xK2m#P";
        const at72 = prefix + "a".repeat(62);
        expect(utf8ByteLength(at72)).toBe(72);
        expect(newPassword(at72).success).toBe(true);
        const at73 = `${at72}b`;
        expect(utf8ByteLength(at73)).toBe(73);
        expect(issuesFor(newPassword(at73)).newPassword).toEqual([
            "validation:password.tooLongBytes",
        ]);
    });

    it("counts two-byte characters by bytes: 36 are fine, 37 are too long although shorter in characters", () => {
        expect(newPassword("é".repeat(36)).success).toBe(true);
        const long = "é".repeat(37);
        expect(long.length).toBe(37);
        expect(issuesFor(newPassword(long)).newPassword).toEqual([
            "validation:password.tooLongBytes",
        ]);
    });

    it("counts three-byte Devanagari characters: 24 pass, 25 fail", () => {
        expect(newPassword("स".repeat(24)).success).toBe(true);
        expect(issuesFor(newPassword("स".repeat(25))).newPassword).toContain(
            "validation:password.tooLongBytes"
        );
    });

    it("counts four-byte emoji: 18 pass, 19 fail", () => {
        expect(newPassword("😀".repeat(18)).success).toBe(true);
        expect(issuesFor(newPassword("😀".repeat(19))).newPassword).toContain(
            "validation:password.tooLongBytes"
        );
    });

    it("keeps the documented limits as constants", () => {
        expect(PASSWORD_MIN_LENGTH).toBe(10);
        expect(PASSWORD_MAX_BYTES).toBe(72);
    });
});

describe("password policy", () => {
    const newPassword = (value) =>
        resetPasswordSchema.safeParse({
            newPassword: value,
            confirmPassword: value,
        });

    it("requires 10 characters, counted as code points", () => {
        expect(issuesFor(newPassword("123456789")).newPassword).toContain(
            "validation:password.tooShort"
        );
        expect(newPassword("Zq9!xK2m#P").success).toBe(true);
        expect(newPassword("😀".repeat(10)).success).toBe(true);
        expect(issuesFor(newPassword("😀".repeat(9))).newPassword).toContain(
            "validation:password.tooShort"
        );
    });

    it("allows spaces and any Unicode", () => {
        expect(newPassword("correct horse battery staple").success).toBe(true);
        expect(newPassword("          x").success).toBe(true);
        expect(newPassword("पासवर्ड-बहुत-सुरक्षित").success).toBe(true);
    });

    it("rejects common passwords, case-insensitively", () => {
        expect(issuesFor(newPassword("Password123")).newPassword).toContain(
            "validation:password.common"
        );
        expect(issuesFor(newPassword("1234567890")).newPassword).toContain(
            "validation:password.common"
        );
    });

    it("requires a password", () => {
        expect(issuesFor(newPassword("")).newPassword).toContain(
            "validation:password.required"
        );
        expect(
            issuesFor(resetPasswordSchema.safeParse({ confirmPassword: "x" }))
                .newPassword
        ).toEqual(["validation:password.required"]);
    });

    it("evaluates each rule independently for a checklist UI", () => {
        expect(evaluatePasswordPolicy("short", {})).toMatchObject({
            minLength: false,
            maxBytes: true,
            notCommon: true,
            noPersonal: true,
        });
        expect(evaluatePasswordPolicy("x".repeat(73), {}).maxBytes).toBe(false);
        expect(evaluatePasswordPolicy("password123", {}).notCommon).toBe(false);
        expect(
            evaluatePasswordPolicy("my-asha.verma-pass", {
                email: "asha.verma@example.test",
            })
        ).toMatchObject({ containsEmail: true, noPersonal: false });
        expect(
            evaluatePasswordPolicy("meera-is-great-1", { name: "Meera Iyer" })
        ).toMatchObject({ containsName: true, noPersonal: false });
        expect(evaluatePasswordPolicy(undefined, {}).minLength).toBe(false);
    });
});

describe("registerSchema", () => {
    it("accepts a valid registration and normalises name and email", () => {
        const result = registerSchema.safeParse({
            ...validRegister,
            name: "  Asha   Verma ",
            email: "  ASHA.Verma@Example.TEST ",
        });
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            email: "asha.verma@example.test",
            acceptTerms: true,
        });
        expect(result.data.name).toBe("Asha   Verma");
    });

    it("uses i18n keys, never English text, for every message", () => {
        const result = registerSchema.safeParse({
            name: "",
            email: "nope",
            password: "",
            confirmPassword: "",
            acceptTerms: false,
        });
        const messages = messagesOf(result);
        expect(messages.length).toBeGreaterThanOrEqual(4);
        for (const message of messages)
            expect(message).toMatch(/^validation:[\w.]+$/);
    });

    it("rejects an invalid or oversized email", () => {
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    email: "no-at-sign",
                })
            ).email
        ).toEqual(["validation:email.invalid"]);
        expect(
            issuesFor(registerSchema.safeParse({ ...validRegister, email: "" }))
                .email
        ).toEqual(["validation:email.required"]);
        const longEmail = `${"a".repeat(250)}@example.test`;
        expect(
            issuesFor(
                registerSchema.safeParse({ ...validRegister, email: longEmail })
            ).email
        ).toEqual(["validation:email.tooLong"]);
    });

    it("validates the name length in characters", () => {
        expect(
            issuesFor(registerSchema.safeParse({ ...validRegister, name: "A" }))
                .name
        ).toEqual(["validation:name.tooShort"]);
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    name: "A".repeat(81),
                })
            ).name
        ).toEqual(["validation:name.tooLong"]);
        expect(
            registerSchema.safeParse({ ...validRegister, name: "अ".repeat(80) })
                .success
        ).toBe(true);
        expect(
            issuesFor(
                registerSchema.safeParse({ ...validRegister, name: "   " })
            ).name
        ).toEqual(["validation:name.required"]);
    });

    it("requires consent", () => {
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    acceptTerms: false,
                })
            ).acceptTerms
        ).toEqual(["validation:terms.required"]);
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    acceptTerms: undefined,
                })
            ).acceptTerms
        ).toEqual(["validation:terms.required"]);
    });

    it("requires matching passwords", () => {
        const result = registerSchema.safeParse({
            ...validRegister,
            confirmPassword: "something else entirely",
        });
        expect(issuesFor(result).confirmPassword).toEqual([
            "validation:confirmPassword.mismatch",
        ]);
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    confirmPassword: "",
                })
            ).confirmPassword
        ).toContain("validation:confirmPassword.required");
    });

    it("rejects a password that contains the email local part or the name", () => {
        const withEmail = "my-asha.verma-secret";
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    password: withEmail,
                    confirmPassword: withEmail,
                })
            ).password
        ).toEqual(["validation:password.containsEmail"]);
        const withName = "VERMA is my surname!";
        expect(
            issuesFor(
                registerSchema.safeParse({
                    ...validRegister,
                    password: withName,
                    confirmPassword: withName,
                })
            ).password
        ).toEqual(["validation:password.containsName"]);
    });

    it("does not trip over short name parts or short local parts", () => {
        const input = {
            ...validRegister,
            name: "Jo Li",
            email: "jo@example.test",
            password: "jo-li-and-friends",
            confirmPassword: "jo-li-and-friends",
        };
        expect(registerSchema.safeParse(input).success).toBe(true);
    });

    it("strips unknown fields such as role", () => {
        const result = registerSchema.safeParse({
            ...validRegister,
            role: "admin",
            orgId: "x",
        });
        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty("role");
        expect(result.data).not.toHaveProperty("orgId");
    });

    it("builds the API body without UI-only fields", () => {
        expect(toRegisterBody({ ...validRegister })).toEqual({
            name: "Asha Verma",
            email: "asha.verma@example.test",
            password: "correct horse battery",
            acceptTerms: true,
        });
    });
});

describe("email normalisation", () => {
    it("trims, lowercases and applies NFKC", () => {
        expect(normalizeEmail("  ＡＢＣ@Example.TEST ")).toBe(
            "abc@example.test"
        );
        expect(normalizeEmail(undefined)).toBe("");
    });

    it("applies it in forgot and resend forms", () => {
        expect(
            forgotPasswordSchema.parse({ email: " Asha@Example.test " }).email
        ).toBe("asha@example.test");
        expect(resendVerificationSchema.safeParse({ email: "" }).success).toBe(
            false
        );
        expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
    });
});

describe("loginSchema", () => {
    it("defaults rememberMe to false and keeps spaces in the password", () => {
        const result = loginSchema.parse({
            email: "A@Example.test",
            password: " spaced ",
        });
        expect(result).toEqual({
            email: "a@example.test",
            password: " spaced ",
            rememberMe: false,
        });
    });

    it("only requires presence of the password, not the full policy", () => {
        expect(
            loginSchema.safeParse({ email: "a@example.test", password: "x" })
                .success
        ).toBe(true);
        expect(
            issuesFor(
                loginSchema.safeParse({ email: "a@example.test", password: "" })
            ).password
        ).toEqual(["validation:password.required"]);
    });

    it("rejects a password over the byte limit before it is sent", () => {
        expect(
            issuesFor(
                loginSchema.safeParse({
                    email: "a@example.test",
                    password: "x".repeat(73),
                })
            ).password
        ).toEqual(["validation:password.tooLongBytes"]);
    });

    it("builds the login body, adding reactivate only when set", () => {
        expect(
            toLoginBody({
                email: "a@example.test",
                password: "p",
                rememberMe: true,
            })
        ).toEqual({ email: "a@example.test", password: "p", rememberMe: true });
        expect(
            toLoginBody({
                email: "a@example.test",
                password: "p",
                reactivate: true,
            })
        ).toEqual({
            email: "a@example.test",
            password: "p",
            rememberMe: false,
            reactivate: true,
        });
    });
});

describe("reset, change and invite schemas", () => {
    it("requires the confirmation to match on reset", () => {
        const result = resetPasswordSchema.safeParse({
            newPassword: "Zq9!xK2m#P",
            confirmPassword: "different-one-1",
        });
        expect(issuesFor(result).confirmPassword).toEqual([
            "validation:confirmPassword.mismatch",
        ]);
    });

    it("rejects reusing the current password when changing it", () => {
        const same = "Zq9!xK2m#P";
        const result = changePasswordSchema.safeParse({
            currentPassword: same,
            newPassword: same,
            confirmPassword: same,
        });
        expect(issuesFor(result).newPassword).toEqual([
            "validation:password.sameAsCurrent",
        ]);
        expect(
            changePasswordSchema.safeParse({
                currentPassword: "old-password-1",
                newPassword: same,
                confirmPassword: same,
            }).success
        ).toBe(true);
    });

    it("requires the current password when changing it", () => {
        const result = changePasswordSchema.safeParse({
            currentPassword: "",
            newPassword: "Zq9!xK2m#P",
            confirmPassword: "Zq9!xK2m#P",
        });
        expect(issuesFor(result).currentPassword).toEqual([
            "validation:password.required",
        ]);
    });

    it("validates the invite form like registration, without an email", () => {
        const input = {
            name: "Dr Rao",
            password: "Zq9!xK2m#P",
            confirmPassword: "Zq9!xK2m#P",
        };
        expect(acceptInviteSchema.safeParse(input).success).toBe(true);
        expect(
            issuesFor(
                acceptInviteSchema.safeParse({
                    ...input,
                    password: "rao rao rao rao",
                    confirmPassword: "rao rao rao rao",
                })
            ).password
        ).toEqual(["validation:password.containsName"]);
        expect(
            issuesFor(acceptInviteSchema.safeParse({ ...input, name: "" })).name
        ).toEqual(["validation:name.required"]);
    });

    it("validates email change and account deletion re-auth", () => {
        expect(
            changeEmailSchema.parse({
                newEmail: " New@Example.test ",
                currentPassword: "p",
            })
        ).toEqual({ newEmail: "new@example.test", currentPassword: "p" });
        expect(
            changeEmailSchema.safeParse({
                newEmail: "bad",
                currentPassword: "",
            }).success
        ).toBe(false);
        expect(
            deleteAccountSchema.safeParse({ currentPassword: "p" }).success
        ).toBe(true);
        expect(deleteAccountSchema.safeParse({}).success).toBe(false);
    });

    it("requires a one-time token", () => {
        expect(oneTimeTokenSchema.safeParse({ token: "abc" }).success).toBe(
            true
        );
        expect(
            issuesFor(oneTimeTokenSchema.safeParse({ token: "" })).token
        ).toEqual(["validation:token.required"]);
        expect(issuesFor(oneTimeTokenSchema.safeParse({})).token).toEqual([
            "validation:token.required",
        ]);
    });
});
