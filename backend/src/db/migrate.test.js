import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { runMigrations } from "./migrate.js";

const quiet = { info() {}, warn() {}, error() {} };

describe("runMigrations (DB-37)", () => {
    let dir;
    beforeAll(startTestDb);
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        dir = await mkdtemp(path.join(os.tmpdir(), "samarth-ai-migrations-"));
    });

    const write = (name, body) => writeFile(path.join(dir, name), body);
    const cleanup = () => rm(dir, { recursive: true, force: true });

    it("applies pending migrations in file order and records them", async () => {
        await write(
            "0002-second.js",
            'export async function up({ db }) { await db.collection("migrated").insertOne({ n: 2 }); }\n'
        );
        await write(
            "0001-first.js",
            'export async function up({ db }) { await db.collection("migrated").insertOne({ n: 1 }); }\n'
        );
        await write("notes.txt", "ignored");
        await write(
            "bad_name.js",
            "throw new Error('must never be imported');"
        );
        const result = await runMigrations({ dir, log: quiet });
        expect(result.applied).toEqual(["0001-first.js", "0002-second.js"]);
        const rows = await mongoose.connection.db
            .collection("migrated")
            .find({})
            .sort({ n: 1 })
            .toArray();
        expect(rows.map((row) => row.n)).toEqual([1, 2]);
        const ledger = await mongoose.connection.db
            .collection("migrations")
            .find({})
            .toArray();
        expect(ledger.map((row) => row.name).sort()).toEqual([
            "0001-first.js",
            "0002-second.js",
        ]);
        await cleanup();
    });

    it("is idempotent: a second run applies nothing", async () => {
        await write(
            "0001-first.js",
            'export async function up({ db }) { await db.collection("migrated").insertOne({ n: 1 }); }\n'
        );
        await runMigrations({ dir, log: quiet });
        const second = await runMigrations({ dir, log: quiet });
        expect(second).toEqual({ applied: [], skipped: ["0001-first.js"] });
        expect(
            await mongoose.connection.db.collection("migrated").countDocuments()
        ).toBe(1);
        await cleanup();
    });

    it("picks up only new files on later runs", async () => {
        await write("0001-first.js", "export async function up() {}\n");
        await runMigrations({ dir, log: quiet });
        await write("0002-second.js", "export async function up() {}\n");
        expect(await runMigrations({ dir, log: quiet })).toEqual({
            applied: ["0002-second.js"],
            skipped: ["0001-first.js"],
        });
        await cleanup();
    });

    it("stops at a failing migration and does not record it", async () => {
        await write("0001-ok.js", "export async function up() {}\n");
        await write(
            "0002-fails.js",
            'export async function up() { throw new Error("nope"); }\n'
        );
        await expect(runMigrations({ dir, log: quiet })).rejects.toThrow(
            "nope"
        );
        const ledger = await mongoose.connection.db
            .collection("migrations")
            .find({})
            .toArray();
        expect(ledger.map((row) => row.name)).toEqual(["0001-ok.js"]);
        await cleanup();
    });

    it("rejects a migration without up()", async () => {
        await write("0001-empty.js", "export const nothing = 1;\n");
        await expect(runMigrations({ dir, log: quiet })).rejects.toThrow(
            "up()"
        );
        await cleanup();
    });

    it("treats a missing directory as nothing to do", async () => {
        await rm(dir, { recursive: true, force: true });
        await mkdir(dir);
        expect(
            await runMigrations({ dir: path.join(dir, "absent"), log: quiet })
        ).toEqual({ applied: [], skipped: [] });
        await cleanup();
    });
});
