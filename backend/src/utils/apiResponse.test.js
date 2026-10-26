import { describe, expect, it, vi } from "vitest";
import { ApiResponse } from "./apiResponse.js";

const fakeRes = () => {
    const res = {
        status: vi.fn(() => res),
        json: vi.fn(() => res),
        end: vi.fn(() => res),
    };
    return res;
};

describe("ApiResponse", () => {
    it("ok builds the success envelope", () => {
        expect(
            JSON.parse(JSON.stringify(ApiResponse.ok({ a: 1 }, "Done")))
        ).toEqual({
            statusCode: 200,
            success: true,
            message: "Done",
            data: { a: 1 },
        });
    });

    it("includes meta only when given", () => {
        expect(ApiResponse.ok([], "Listed", { page: 1 })).toMatchObject({
            meta: { page: 1 },
        });
        expect(ApiResponse.ok([])).not.toHaveProperty("meta");
    });

    it("created and accepted use 201 and 202 with null data by default", () => {
        expect(ApiResponse.created()).toMatchObject({
            statusCode: 201,
            data: null,
            success: true,
        });
        expect(ApiResponse.accepted()).toMatchObject({
            statusCode: 202,
            data: null,
        });
    });

    it("send writes JSON with the status and returns itself", () => {
        const res = fakeRes();
        const response = ApiResponse.created({ id: 1 });
        expect(response.send(res)).toBe(response);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(response);
    });

    it("noContent sends 204 with no body", () => {
        const res = fakeRes();
        ApiResponse.noContent().send(res);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.end).toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});
