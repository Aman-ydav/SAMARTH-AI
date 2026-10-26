import { expect } from "vitest";

/** Asserts the success envelope of DECISIONS section 5 (TEST-12). Returns the body for further checks. */
export function expectSuccess(response, statusCode = 200) {
    expect(response.status).toBe(statusCode);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    const body = response.body;
    expect(body).toMatchObject({ statusCode, success: true });
    expect(typeof body.message).toBe("string");
    expect(body).toHaveProperty("data");
    expect(
        Object.keys(body).filter(
            (key) =>
                !["statusCode", "success", "message", "data", "meta"].includes(
                    key
                )
        )
    ).toEqual([]);
    return body;
}

/** Asserts the error envelope incl. `requestId` equal to the X-Request-Id header (R35). Returns the body. */
export function expectError(response, statusCode, code) {
    expect(response.status).toBe(statusCode);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    const body = response.body;
    expect(body).toMatchObject({
        statusCode,
        success: false,
        code,
        data: null,
    });
    expect(typeof body.message).toBe("string");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.requestId).toBeTruthy();
    expect(body.requestId).toBe(response.headers["x-request-id"]);
    return body;
}
