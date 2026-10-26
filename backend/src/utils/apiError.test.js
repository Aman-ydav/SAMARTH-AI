import { describe, expect, it } from "vitest";
import { ERROR_CATALOG, ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "./apiError.js";

describe("ApiError", () => {
    it("carries statusCode, code, message, errors, isOperational and an Error stack", () => {
        const error = new ApiError({
            statusCode: 418,
            code: "TEAPOT",
            message: "short and stout",
        });
        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({
            name: "ApiError",
            statusCode: 418,
            code: "TEAPOT",
            message: "short and stout",
            errors: [],
            isOperational: true,
        });
        expect(error.stack).toContain("ApiError");
        expect(error).not.toHaveProperty("retryAfterSec");
    });

    it("defaults the message from the catalogue and keeps cause and retryAfterSec", () => {
        const cause = new Error("db");
        const error = new ApiError({
            statusCode: 429,
            code: ERROR_CODES.RATE_LIMITED,
            retryAfterSec: 30,
            cause,
        });
        expect(error.message).toBe(ERROR_CATALOG.RATE_LIMITED.message);
        expect(error.retryAfterSec).toBe(30);
        expect(error.cause).toBe(cause);
    });

    it.each([
        ["badRequest", 400, "BAD_REQUEST"],
        ["unauthorized", 401, "AUTH_REQUIRED"],
        ["forbidden", 403, "FORBIDDEN"],
        ["notFound", 404, "NOT_FOUND"],
        ["conflict", 409, "CONFLICT"],
        ["unprocessable", 422, "UNPROCESSABLE"],
        ["locked", 423, "ACCOUNT_LOCKED"],
        ["tooManyRequests", 429, "RATE_LIMITED"],
        ["internal", 500, "INTERNAL"],
        ["badGateway", 502, "INTEGRATION_ERROR"],
        ["serviceUnavailable", 503, "INTEGRATION_ERROR"],
    ])("factory %s gives %i %s by default", (factory, statusCode, code) => {
        const error = ApiError[factory]();
        expect(error).toMatchObject({ statusCode, code, isOperational: true });
        expect(error.message.length).toBeGreaterThan(0);
    });

    it("factories accept a code, message and errors", () => {
        const error = ApiError.unauthorized(ERROR_CODES.INVALID_CREDENTIALS, {
            message: "nope",
            errors: [{ field: "email", message: "bad" }],
        });
        expect(error).toMatchObject({
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
            message: "nope",
        });
        expect(error.errors).toEqual([{ field: "email", message: "bad" }]);
    });

    it("validation() builds VALIDATION_ERROR with field entries", () => {
        const error = ApiError.validation([
            { field: "name", message: "required", code: "too_small" },
        ]);
        expect(error).toMatchObject({
            statusCode: 400,
            code: "VALIDATION_ERROR",
        });
        expect(error.errors).toHaveLength(1);
    });

    it("fromCode takes the status from the catalogue and falls back to 500 for unknown codes", () => {
        expect(ApiError.fromCode(ERROR_CODES.ACCOUNT_LOCKED).statusCode).toBe(
            423
        );
        expect(
            ApiError.fromCode(ERROR_CODES.PAYLOAD_TOO_LARGE).statusCode
        ).toBe(413);
        expect(ApiError.fromCode("NOT_A_CODE").statusCode).toBe(500);
    });

    it("can be marked non-operational", () => {
        expect(
            ApiError.internal(ERROR_CODES.INTERNAL, { isOperational: false })
                .isOperational
        ).toBe(false);
    });
});

describe("error code catalogue", () => {
    it("maps every code to itself with a status and a message", () => {
        for (const [key, value] of Object.entries(ERROR_CODES)) {
            expect(value).toBe(key);
            expect(ERROR_CATALOG[key].status).toBeGreaterThanOrEqual(400);
            expect(ERROR_CATALOG[key].message).toMatch(/\.$/);
        }
    });

    it("matches the statuses fixed by DECISIONS R38 and doc 08", () => {
        expect(ERROR_CATALOG).toMatchObject({
            ACCOUNT_LOCKED: { status: 423 },
            REAUTH_REQUIRED: { status: 403 },
            LAST_ADMIN: { status: 409 },
            AUTH_METHOD_REQUIRED: { status: 409 },
            PASSWORD_POLICY: { status: 400 },
            PASSWORD_REUSED: { status: 400 },
            EMAIL_CHANGE_INVALID: { status: 400 },
            WEBHOOK_SIGNATURE_INVALID: { status: 400 },
            CSRF_INVALID: { status: 403 },
            CORS_ORIGIN_DENIED: { status: 403 },
            RATE_LIMITED: { status: 429 },
        });
    });
});
