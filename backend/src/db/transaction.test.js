import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { withTransaction } from "./transaction.js";

const Ledger = mongoose.model(
    "TxLedger",
    new mongoose.Schema({ label: String }),
    "txLedgers"
);

describe("withTransaction (DB-32)", () => {
    beforeAll(async () => {
        await startTestDb();
        await Ledger.createCollection();
    });
    afterAll(stopTestDb);
    beforeEach(clearCollections);

    it("commits every write when the work succeeds and returns its result", async () => {
        const result = await withTransaction(async (session) => {
            await Ledger.create([{ label: "a" }], { session });
            await Ledger.create([{ label: "b" }], { session });
            return "done";
        });
        expect(result).toBe("done");
        expect(await Ledger.countDocuments()).toBe(2);
    });

    it("rolls back every write when the work throws", async () => {
        await expect(
            withTransaction(async (session) => {
                await Ledger.create([{ label: "a" }], { session });
                throw new Error("abort");
            })
        ).rejects.toThrow("abort");
        expect(await Ledger.countDocuments()).toBe(0);
    });
});
