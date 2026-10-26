import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb } from "#tests/helpers/testDb.js";
import { anyOf, gt, gte, lt, lte, ne, noneOf } from "./mongoOps.js";

const Item = mongoose.model(
    "MongoOpsItem",
    new mongoose.Schema(
        { n: Number, tag: { type: String, trim: true, maxlength: 10 } },
        { timestamps: true, collection: "mongoOpsItems" }
    )
);

describe("trusted filter operators", () => {
    beforeAll(async () => {
        await startTestDb();
        await Item.create([
            { n: 1, tag: "a" },
            { n: 2, tag: "b" },
            { n: 3, tag: "c" },
        ]);
    });
    afterAll(stopTestDb);

    const count = (filter) => Item.countDocuments(filter);

    it("work although sanitizeFilter is on", async () => {
        expect(mongoose.get("sanitizeFilter")).toBe(true);
        expect(await count({ n: gt(1) })).toBe(2);
        expect(await count({ n: gte(2) })).toBe(2);
        expect(await count({ n: lt(3) })).toBe(2);
        expect(await count({ n: lte(1) })).toBe(1);
        expect(await count({ n: ne(2) })).toBe(2);
        expect(await count({ tag: anyOf(["a", "c"]) })).toBe(2);
        expect(await count({ tag: noneOf(["a", "c"]) })).toBe(1);
    });

    it("do not trust operators coming from elsewhere (sanitizeFilter still blocks them)", async () => {
        await expect(count({ n: { $gt: 0 } })).rejects.toThrow();
    });
});
