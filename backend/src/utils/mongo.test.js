import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { ApiError } from "./apiError.js";
import { escapeRegex, isValidObjectId, toObjectId } from "./mongo.js";

describe("isValidObjectId", () => {
    it("accepts 24 hex characters only", () => {
        expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
        expect(isValidObjectId("507F1F77BCF86CD799439011")).toBe(true);
        expect(isValidObjectId("twelve chars")).toBe(false);
        expect(isValidObjectId("507f1f77bcf86cd79943901")).toBe(false);
        expect(isValidObjectId({ $ne: null })).toBe(false);
        expect(isValidObjectId(undefined)).toBe(false);
    });
});

describe("toObjectId", () => {
    it("casts valid ids and passes ObjectIds through", () => {
        const id = toObjectId("507f1f77bcf86cd799439011");
        expect(id).toBeInstanceOf(mongoose.Types.ObjectId);
        expect(toObjectId(id)).toBe(id);
    });

    it("throws 400 INVALID_ID naming the field", () => {
        try {
            toObjectId("nope", "courseId");
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError);
            expect(error).toMatchObject({
                statusCode: 400,
                code: "INVALID_ID",
            });
            expect(error.errors[0].field).toBe("courseId");
        }
    });
});

describe("escapeRegex", () => {
    it("escapes every metacharacter so input cannot change the pattern", () => {
        const hostile = ".*+?^${}()|[]\\";
        expect(new RegExp(`^${escapeRegex(hostile)}$`).test(hostile)).toBe(
            true
        );
        expect(new RegExp(`^${escapeRegex("a.c")}$`).test("abc")).toBe(false);
    });
});
