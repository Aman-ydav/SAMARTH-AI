import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { softDeletePlugin } from "./softDeletePlugin.js";

const schema = new mongoose.Schema({
    title: { type: String, trim: true, maxlength: 50 },
});
schema.plugin(softDeletePlugin);
const Doc = mongoose.model("SoftDoc", schema, "softDocs");

describe("softDeletePlugin (DB-27, DB-28)", () => {
    beforeAll(startTestDb);
    afterAll(stopTestDb);
    beforeEach(clearCollections);

    it("adds deletedAt defaulting to null", async () => {
        const doc = await Doc.create({ title: "live" });
        expect(doc.deletedAt).toBeNull();
    });

    it("hides soft-deleted documents from find, findOne and countDocuments", async () => {
        await Doc.create([
            { title: "live" },
            { title: "gone", deletedAt: new Date() },
        ]);
        expect((await Doc.find().lean()).map((d) => d.title)).toEqual(["live"]);
        expect(await Doc.findOne({ title: "gone" })).toBeNull();
        expect(await Doc.countDocuments()).toBe(1);
    });

    it("includes them with withDeleted", async () => {
        await Doc.create([
            { title: "live" },
            { title: "gone", deletedAt: new Date() },
        ]);
        expect(
            await Doc.find().setOptions({ withDeleted: true }).countDocuments()
        ).toBe(2);
    });

    it("does not let updates touch deleted documents", async () => {
        await Doc.create({ title: "gone", deletedAt: new Date() });
        const result = await Doc.updateOne(
            { title: "gone" },
            { title: "revived" }
        );
        expect(result.matchedCount).toBe(0);
    });

    it("respects an explicit deletedAt filter", async () => {
        await Doc.create({ title: "gone", deletedAt: new Date() });
        // sanitizeFilter is on (BE-62), so a trusted operator must be marked explicitly.
        expect(
            await Doc.countDocuments({
                deletedAt: mongoose.trusted({ $ne: null }),
            })
        ).toBe(1);
    });
});
