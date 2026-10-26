import { describe, expect, it } from "vitest";
import {
    AVATAR_MAX_BYTES,
    AVATAR_PROBLEMS,
    buildChangeEmailFormSchema,
    buildDeleteAccountFormSchema,
    checkAvatarSignature,
    diffProfile,
    isValidTimeZone,
    profileSchema,
    sniffImageType,
    validateAvatarFile,
} from "@/features/auth/schemas/settingsSchemas";

const messages = (result) => result.error.issues.map((issue) => issue.message);
const file = (overrides = {}) => ({
    name: "me.png",
    type: "image/png",
    size: 1000,
    ...overrides,
});

const TYPE = {
    png: "image/" + "png",
    jpeg: "image/" + "jpeg",
    webp: "image/" + "webp",
};
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

function blobOf(bytes, type) {
    return new File([new Uint8Array(bytes)], "x", { type });
}

describe("isValidTimeZone", () => {
    it("accepts IANA names and rejects junk", () => {
        expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
        expect(isValidTimeZone("UTC")).toBe(true);
        expect(isValidTimeZone("Mars/Olympus")).toBe(false);
        expect(isValidTimeZone("")).toBe(false);
        expect(isValidTimeZone(null)).toBe(false);
    });
});

describe("profileSchema", () => {
    const valid = {
        name: "  Asha Verma ",
        locale: "hi",
        timezone: " Asia/Kolkata ",
    };

    it("trims the name and the time zone", () => {
        const result = profileSchema.safeParse(valid);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            name: "Asha Verma",
            locale: "hi",
            timezone: "Asia/Kolkata",
        });
    });

    it.each([
        [{ ...valid, name: "   " }, "validation:name.required"],
        [{ ...valid, name: "A" }, "validation:name.tooShort"],
        [{ ...valid, name: "x".repeat(81) }, "validation:name.tooLong"],
        [{ ...valid, locale: "fr" }, "validation:locale.invalid"],
        [{ ...valid, timezone: "" }, "validation:timezone.required"],
        [{ ...valid, timezone: "Nowhere/Land" }, "validation:timezone.invalid"],
        [{ ...valid, timezone: "x".repeat(65) }, "validation:timezone.invalid"],
    ])("rejects %j with an i18n key", (input, key) => {
        const result = profileSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(messages(result)).toContain(key);
    });
});

describe("diffProfile", () => {
    const saved = { name: "Asha", locale: "en", timezone: "Asia/Kolkata" };

    it("returns only changed fields", () => {
        expect(diffProfile({ ...saved, locale: "hi" }, saved)).toEqual({
            locale: "hi",
        });
        expect(
            diffProfile({ ...saved, name: "B", timezone: "UTC" }, saved)
        ).toEqual({ name: "B", timezone: "UTC" });
    });

    it("returns an empty patch for a no-op", () => {
        expect(diffProfile({ ...saved }, saved)).toEqual({});
    });
});

describe("validateAvatarFile", () => {
    it("accepts a normal png, jpeg and webp", () => {
        expect(validateAvatarFile(file())).toBeNull();
        expect(
            validateAvatarFile(file({ name: "a.JPG", type: "image/jpeg" }))
        ).toBeNull();
        expect(
            validateAvatarFile(file({ name: "a.webp", type: "image/webp" }))
        ).toBeNull();
    });

    it("rejects missing and empty files", () => {
        expect(validateAvatarFile(undefined)).toBe(AVATAR_PROBLEMS.empty);
        expect(validateAvatarFile(file({ size: 0 }))).toBe(
            AVATAR_PROBLEMS.empty
        );
    });

    it("rejects the wrong type or extension (svg, gif, pdf, spoofed name)", () => {
        expect(
            validateAvatarFile(file({ name: "a.svg", type: "image/svg+xml" }))
        ).toBe(AVATAR_PROBLEMS.type);
        expect(
            validateAvatarFile(file({ name: "a.gif", type: "image/gif" }))
        ).toBe(AVATAR_PROBLEMS.type);
        expect(
            validateAvatarFile(file({ name: "a.png", type: "application/pdf" }))
        ).toBe(AVATAR_PROBLEMS.type);
        expect(
            validateAvatarFile(file({ name: "a.exe", type: "image/png" }))
        ).toBe(AVATAR_PROBLEMS.type);
    });

    it("enforces the 2 MB ceiling exactly", () => {
        expect(validateAvatarFile(file({ size: AVATAR_MAX_BYTES }))).toBeNull();
        expect(validateAvatarFile(file({ size: AVATAR_MAX_BYTES + 1 }))).toBe(
            AVATAR_PROBLEMS.tooLarge
        );
    });
});

describe("sniffImageType and checkAvatarSignature", () => {
    it("recognises the three allowed formats by their first bytes", () => {
        expect(sniffImageType(Uint8Array.from(PNG))).toBe(TYPE.png);
        expect(sniffImageType(Uint8Array.from(JPEG))).toBe(TYPE.jpeg);
        expect(sniffImageType(Uint8Array.from(WEBP))).toBe(TYPE.webp);
    });

    it("returns null for short, unknown or missing input", () => {
        expect(sniffImageType(Uint8Array.from([1, 2, 3]))).toBeNull();
        expect(sniffImageType(Uint8Array.from(Array(12).fill(1)))).toBeNull();
        expect(sniffImageType(undefined)).toBeNull();
    });

    it("passes a file whose bytes match its type", async () => {
        expect(await checkAvatarSignature(blobOf(PNG, TYPE.png))).toBeNull();
    });

    it("flags a renamed file whose bytes do not match", async () => {
        expect(
            await checkAvatarSignature(
                blobOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], TYPE.png)
            )
        ).toBe(AVATAR_PROBLEMS.mismatch);
        expect(await checkAvatarSignature(blobOf(JPEG, TYPE.png))).toBe(
            AVATAR_PROBLEMS.mismatch
        );
    });

    it("skips the check when the browser cannot read the blob", async () => {
        expect(await checkAvatarSignature(null)).toBeNull();
        expect(await checkAvatarSignature({ slice: () => ({}) })).toBeNull();
    });
});

describe("buildChangeEmailFormSchema", () => {
    const current = "asha.verma@example.test";

    it("requires the current password for accounts that have one", () => {
        const schema = buildChangeEmailFormSchema(current);
        const result = schema.safeParse({ newEmail: "new@example.test" });
        expect(result.success).toBe(false);
        expect(messages(result)).toContain("validation:password.required");
        expect(
            schema.safeParse({
                newEmail: " New@Example.test ",
                currentPassword: "pw",
            }).data
        ).toEqual({ newEmail: "new@example.test", currentPassword: "pw" });
    });

    it("needs only the new email for Google-only accounts", () => {
        const schema = buildChangeEmailFormSchema(current, {
            requiresPassword: false,
        });
        expect(schema.safeParse({ newEmail: "new@example.test" }).success).toBe(
            true
        );
    });

    it("rejects the address the account already has, ignoring case", () => {
        const result = buildChangeEmailFormSchema(current, {
            requiresPassword: false,
        }).safeParse({ newEmail: "ASHA.verma@example.test" });
        expect(messages(result)).toContain("validation:email.sameAsCurrent");
    });

    it("rejects an invalid address", () => {
        const result = buildChangeEmailFormSchema(current).safeParse({
            newEmail: "nope",
            currentPassword: "pw",
        });
        expect(messages(result)).toContain("validation:email.invalid");
    });
});

describe("buildDeleteAccountFormSchema", () => {
    it("needs the typed phrase (any case) and the password", () => {
        const schema = buildDeleteAccountFormSchema("DELETE");
        expect(
            schema.safeParse({
                confirmation: " delete ",
                currentPassword: "pw",
            }).success
        ).toBe(true);
        const wrong = schema.safeParse({
            confirmation: "remove",
            currentPassword: "pw",
        });
        expect(messages(wrong)).toContain("validation:confirmPhrase.mismatch");
        const noPassword = schema.safeParse({ confirmation: "DELETE" });
        expect(messages(noPassword)).toContain("validation:password.required");
    });

    it("skips the password for Google-only accounts", () => {
        const schema = buildDeleteAccountFormSchema("DELETE", {
            requiresPassword: false,
        });
        expect(schema.safeParse({ confirmation: "DELETE" }).success).toBe(true);
        expect(schema.safeParse({ confirmation: "" }).success).toBe(false);
    });
});
