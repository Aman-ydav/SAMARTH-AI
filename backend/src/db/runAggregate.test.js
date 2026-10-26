import mongoose from "mongoose";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { runAggregate, scopeStage } from "./runAggregate.js";

const Item = mongoose.model(
    "AggItem",
    new mongoose.Schema({
        orgId: String,
        score: Number,
        deletedAt: { type: Date, default: null },
    }),
    "aggItems"
);

describe("runAggregate", () => {
    beforeAll(startTestDb);
    afterAll(stopTestDb);
    beforeEach(clearCollections);

    it("runs the pipeline and returns the documents", async () => {
        await Item.create([
            { orgId: "o1", score: 1 },
            { orgId: "o1", score: 3 },
            { orgId: "o2", score: 5 },
        ]);
        const result = await runAggregate(Item, [
            scopeStage({ orgId: "o1" }),
            { $group: { _id: null, total: { $sum: "$score" } } },
        ]);
        expect(result).toEqual([{ _id: null, total: 4 }]);
    });

    it("forces maxTimeMS 5000 and no disk use by default (DB-56)", async () => {
        const spy = vi.spyOn(Item, "aggregate");
        await runAggregate(Item, [{ $match: { orgId: "o1" } }]);
        const options = spy.mock.results[0].value.options;
        expect(options).toMatchObject({ maxTimeMS: 5000, allowDiskUse: false });
    });

    it("lets jobs raise the limits explicitly", async () => {
        const spy = vi.spyOn(Item, "aggregate");
        await runAggregate(Item, [{ $match: {} }], {
            maxTimeMS: 30_000,
            allowDiskUse: true,
        });
        expect(spy.mock.results[0].value.options).toMatchObject({
            maxTimeMS: 30_000,
            allowDiskUse: true,
        });
    });

    it("passes a session through", async () => {
        await Item.create({ orgId: "o1", score: 2 });
        const result = await mongoose.connection.transaction((session) =>
            runAggregate(Item, [{ $match: { orgId: "o1" } }], { session })
        );
        expect(result).toHaveLength(1);
    });
});

describe("scopeStage (DB-59)", () => {
    it("scopes by org and hides soft-deleted documents by default", () => {
        expect(scopeStage({ orgId: "o1" })).toEqual({
            $match: { orgId: "o1", deletedAt: null },
        });
    });

    it("can include deleted documents and extra equality filters", () => {
        expect(
            scopeStage({
                orgId: "o1",
                includeDeleted: true,
                extra: { status: "active" },
            })
        ).toEqual({
            $match: { orgId: "o1", status: "active" },
        });
    });
});
