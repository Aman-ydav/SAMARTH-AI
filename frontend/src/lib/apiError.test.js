import { describe, expect, it } from "vitest";
import {
    API_ERROR_CODES,
    ApiError,
    apiErrorFromResponse,
    codeForStatus,
    errorMessageKey,
    isApiError,
    isCanceledError,
    isSessionEndingError,
    isTransientError,
    parseRetryAfter,
    retryAfterFromBody,
    toApiError,
} from "@/lib/apiError";

describe("codeForStatus", () => {
    it.each([
        [400, "BAD_REQUEST"],
        [401, "UNAUTHENTICATED"],
        [403, "FORBIDDEN"],
        [404, "NOT_FOUND"],
        [409, "CONFLICT"],
        [413, "PAYLOAD_TOO_LARGE"],
        [422, "VALIDATION_ERROR"],
        [429, "RATE_LIMITED"],
        [500, "SERVER_ERROR"],
        [503, "SERVER_ERROR"],
        [418, "BAD_REQUEST"],
        [200, "UNKNOWN"],
    ])("maps status %i to %s", (status, code) => {
        expect(codeForStatus(status)).toBe(code);
    });
});

describe("parseRetryAfter", () => {
    it("parses delta seconds", () => {
        expect(parseRetryAfter("120")).toBe(120);
        expect(parseRetryAfter(30)).toBe(30);
    });

    it("parses an HTTP date relative to now", () => {
        const now = Date.parse("2026-10-26T10:00:00Z");
        expect(parseRetryAfter("Mon, 26 Oct 2026 10:01:00 GMT", now)).toBe(60);
        expect(parseRetryAfter("Mon, 26 Oct 2026 09:00:00 GMT", now)).toBe(0);
    });

    it("returns null for missing or garbage values", () => {
        expect(parseRetryAfter(undefined)).toBeNull();
        expect(parseRetryAfter("")).toBeNull();
        expect(parseRetryAfter("soon")).toBeNull();
    });
});

describe("retryAfterFromBody", () => {
    it("reads top-level, meta and errors[] entries", () => {
        expect(retryAfterFromBody({ retryAfterSec: 5 })).toBe(5);
        expect(retryAfterFromBody({ meta: { retryAfterSec: 7.2 } })).toBe(8);
        expect(
            retryAfterFromBody({ errors: [{ message: "x", retryAfterSec: 9 }] })
        ).toBe(9);
    });

    it("ignores invalid values", () => {
        expect(retryAfterFromBody({ retryAfterSec: -1 })).toBeNull();
        expect(retryAfterFromBody(null)).toBeNull();
        expect(retryAfterFromBody({ retryAfterSec: "5" })).toBeNull();
    });
});

describe("apiErrorFromResponse", () => {
    it("lets the server code win over the status mapping", () => {
        const error = apiErrorFromResponse(401, {
            code: "TOKEN_EXPIRED",
            message: "expired",
            requestId: "r1",
            errors: [
                { field: "email", message: "bad", code: "x" },
                null,
                { message: 3 },
            ],
        });
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            statusCode: 401,
            code: "TOKEN_EXPIRED",
            message: "expired",
            requestId: "r1",
        });
        expect(error.errors).toEqual([
            { field: "email", message: "bad", code: "x" },
            { message: "" },
        ]);
    });

    it("falls back to the status code and header request id", () => {
        const error = apiErrorFromResponse(503, "<html>", {
            requestIdHeader: "hdr-1",
            retryAfterHeader: "10",
        });
        expect(error).toMatchObject({
            statusCode: 503,
            code: "SERVER_ERROR",
            requestId: "hdr-1",
            retryAfterSec: 10,
        });
    });

    it("prefers the Retry-After header over the body", () => {
        const error = apiErrorFromResponse(
            429,
            { code: "RATE_LIMITED", retryAfterSec: 99 },
            { retryAfterHeader: "3" }
        );
        expect(error.retryAfterSec).toBe(3);
    });
});

describe("toApiError", () => {
    it("returns a plain serialisable copy of an ApiError", () => {
        const plain = toApiError(
            new ApiError({
                statusCode: 429,
                code: "RATE_LIMITED",
                message: "slow down",
                retryAfterSec: 4,
                requestId: "r9",
            })
        );
        expect(plain).toEqual({
            statusCode: 429,
            code: "RATE_LIMITED",
            message: "slow down",
            errors: [],
            retryAfterSec: 4,
            requestId: "r9",
        });
        expect(Object.getPrototypeOf(plain)).toBe(Object.prototype);
    });

    it("turns anything else into UNKNOWN without copying raw messages", () => {
        expect(toApiError(new Error("secret internals"))).toEqual({
            statusCode: 0,
            code: "UNKNOWN",
            message: "",
            errors: [],
            retryAfterSec: null,
            requestId: null,
        });
        expect(toApiError(undefined).code).toBe("UNKNOWN");
        expect(toApiError("boom").code).toBe("UNKNOWN");
    });

    it("accepts plain objects that already have the shape", () => {
        expect(
            toApiError({ statusCode: 200, code: "INVALID_RESPONSE" })
        ).toMatchObject({
            statusCode: 200,
            code: "INVALID_RESPONSE",
            errors: [],
        });
    });
});

describe("predicates", () => {
    it("classifies errors", () => {
        const make = (statusCode, code) => ({
            statusCode,
            code,
            errors: [],
            message: "",
        });
        expect(isApiError(make(400, "X"))).toBe(true);
        expect(isApiError({})).toBe(false);
        expect(isCanceledError(make(0, API_ERROR_CODES.REQUEST_CANCELED))).toBe(
            true
        );
        expect(isSessionEndingError(make(401, "REFRESH_INVALID"))).toBe(true);
        expect(isSessionEndingError(make(401, "TOKEN_EXPIRED"))).toBe(false);
        expect(isTransientError(make(0, "NETWORK_ERROR"))).toBe(true);
        expect(isTransientError(make(503, "SERVER_ERROR"))).toBe(true);
        expect(isTransientError(make(401, "AUTH_REQUIRED"))).toBe(false);
    });

    it("builds i18n keys with an UNKNOWN fallback", () => {
        expect(errorMessageKey("RATE_LIMITED")).toBe(
            "errors:codes.RATE_LIMITED"
        );
        expect(errorMessageKey(undefined)).toBe("errors:codes.UNKNOWN");
    });
});
