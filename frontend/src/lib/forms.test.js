import { describe, expect, it, vi } from "vitest";
import {
    applyServerErrors,
    codePointLength,
    omitKeys,
    utf8ByteLength,
} from "@/lib/forms";

describe("utf8ByteLength", () => {
    it("counts bytes, not characters", () => {
        expect(utf8ByteLength("abc")).toBe(3);
        expect(utf8ByteLength("é")).toBe(2);
        expect(utf8ByteLength("पास")).toBe(9);
        expect(utf8ByteLength("😀")).toBe(4);
        expect(utf8ByteLength("")).toBe(0);
        expect(utf8ByteLength(undefined)).toBe(0);
    });
});

describe("codePointLength", () => {
    it("counts an emoji once", () => {
        expect("😀".length).toBe(2);
        expect(codePointLength("😀")).toBe(1);
        expect(codePointLength(null)).toBe(0);
    });
});

describe("applyServerErrors", () => {
    it("maps field errors onto known fields and focuses the first", () => {
        const setError = vi.fn();
        const setFocus = vi.fn();
        const result = applyServerErrors(
            {
                code: "VALIDATION_ERROR",
                errors: [
                    { field: "email", message: "Invalid email" },
                    { field: "unknown", message: "?" },
                    { field: "name", message: "Too short" },
                ],
            },
            { setError, setFocus, fields: ["email", "name"] }
        );
        expect(setError).toHaveBeenCalledWith("email", {
            type: "server",
            message: "Invalid email",
        });
        expect(setError).toHaveBeenCalledWith("name", {
            type: "server",
            message: "Too short",
        });
        expect(setError).toHaveBeenCalledTimes(2);
        expect(setFocus).toHaveBeenCalledWith("email");
        expect(result).toEqual({ fieldCount: 2, formErrorCode: null });
    });

    it("falls back to a form-level i18n key when no field matches", () => {
        const setError = vi.fn();
        const result = applyServerErrors(
            { code: "INVALID_CREDENTIALS", errors: [] },
            { setError, fields: ["email"] }
        );
        expect(setError).toHaveBeenCalledWith("root.server", {
            type: "INVALID_CREDENTIALS",
            message: "errors:codes.INVALID_CREDENTIALS",
        });
        expect(result).toEqual({
            fieldCount: 0,
            formErrorCode: "INVALID_CREDENTIALS",
        });
    });

    it("uses UNKNOWN when the error has no code and tolerates missing helpers", () => {
        expect(applyServerErrors(undefined)).toEqual({
            fieldCount: 0,
            formErrorCode: "UNKNOWN",
        });
    });

    it("uses the error code key when a field error has no message", () => {
        const setError = vi.fn();
        applyServerErrors(
            {
                errors: [
                    { field: "email", message: "", code: "DOMAIN_NOT_ALLOWED" },
                ],
            },
            { setError, fields: ["email"] }
        );
        expect(setError).toHaveBeenCalledWith("email", {
            type: "server",
            message: "errors:codes.DOMAIN_NOT_ALLOWED",
        });
    });
});

describe("omitKeys", () => {
    it("removes UI-only keys without mutating the input", () => {
        const values = { a: 1, confirmPassword: "x" };
        expect(omitKeys(values, ["confirmPassword"])).toEqual({ a: 1 });
        expect(values.confirmPassword).toBe("x");
    });
});
