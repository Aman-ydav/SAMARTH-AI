import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb, stopTestDb } from "#tests/helpers/testDb.js";
import {
    applyAllIndexes,
    diffAllIndexes,
    loadModels,
    main,
} from "./syncIndexes.js";

const schema = new mongoose.Schema(
    { code: { type: String, trim: true, maxlength: 20 } },
    { autoIndex: false }
);
schema.index({ code: 1 }, { name: "indexed_codes_code_uq", unique: true });
mongoose.model("IndexedCode", schema, "indexedCodes");

describe("index sync (DB-25)", () => {
    beforeAll(async () => {
        await startTestDb();
        await mongoose.model("IndexedCode").createCollection();
    });
    afterAll(stopTestDb);

    it("dry run reports indexes to create without creating them", async () => {
        const report = await diffAllIndexes();
        const entry = report.find((item) => item.model === "IndexedCode");
        expect(entry.toCreate).toEqual([{ code: 1 }]);
        const existing = await mongoose
            .model("IndexedCode")
            .collection.indexes();
        expect(existing.map((index) => index.name)).not.toContain(
            "indexed_codes_code_uq"
        );
    });

    it("apply creates the declared indexes and the diff becomes empty", async () => {
        await applyAllIndexes();
        const existing = await mongoose
            .model("IndexedCode")
            .collection.indexes();
        expect(existing.map((index) => index.name)).toContain(
            "indexed_codes_code_uq"
        );
        const entry = (await diffAllIndexes()).find(
            (item) => item.model === "IndexedCode"
        );
        expect(entry.toCreate).toEqual([]);
        expect(entry.toDrop).toEqual([]);
    });

    it("main prints the diff and only applies indexes with --apply", async () => {
        const write = vi
            .spyOn(process.stdout, "write")
            .mockImplementation(() => true);
        await main([]);
        const dryRun = write.mock.calls.map(([text]) => String(text)).join("");
        expect(dryRun).toContain("IndexedCode");
        expect(dryRun).not.toContain("dropped");
        write.mockClear();
        await main(["--apply"]);
        expect(
            write.mock.calls.map(([text]) => String(text)).join("")
        ).toContain("dropped");
    });
});

describe("loadModels", () => {
    it("returns the registered models when the modules directory does not exist", async () => {
        const names = await loadModels(
            path.join(os.tmpdir(), "samarth-ai-no-such-dir")
        );
        expect(Array.isArray(names)).toBe(true);
    });

    it("tolerates module folders without model files", async () => {
        const dir = await mkdtemp(
            path.join(os.tmpdir(), "samarth-ai-modules-")
        );
        try {
            await expect(loadModels(dir)).resolves.toEqual(expect.any(Array));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
