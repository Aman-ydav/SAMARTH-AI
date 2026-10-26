import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { logger } from "#utils/logger.js";
import { runAsScript } from "./connect.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));
const FILE_PATTERN = /^\d{4}-[a-z][a-z0-9-]*\.js$/;
const COLLECTION = "migrations";

/**
 * Applies pending forward-only migrations in file order (DB-37). Each file `NNNN-<kebab>.js` exports `up({ db, connection })`
 * and must be idempotent. Applied names are stored in the `migrations` collection; a recorded name is never re-run.
 * @returns {Promise<{applied: string[], skipped: string[]}>}
 */
export async function runMigrations({
    dir = MIGRATIONS_DIR,
    connection = mongoose.connection,
    log = logger,
} = {}) {
    let files = [];
    try {
        files = (await readdir(dir))
            .filter((name) => FILE_PATTERN.test(name))
            .sort();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    const ledger = connection.db.collection(COLLECTION);
    await ledger.createIndex(
        { name: 1 },
        { unique: true, name: "migrations_name_uq" }
    );
    const done = new Set(
        (await ledger.find({}, { projection: { name: 1 } }).toArray()).map(
            (row) => row.name
        )
    );

    const applied = [];
    const skipped = [];
    for (const file of files) {
        if (done.has(file)) {
            skipped.push(file);
            continue;
        }
        const migration = await import(
            pathToFileURL(path.join(dir, file)).href
        );
        if (typeof migration.up !== "function")
            throw new Error(`Migration ${file} must export an up() function`);
        await migration.up({ db: connection.db, connection });
        await ledger.updateOne(
            { name: file },
            { $setOnInsert: { name: file, appliedAt: new Date() } },
            { upsert: true }
        );
        log.info({ migration: file }, "migration applied");
        applied.push(file);
    }
    return { applied, skipped };
}

await runAsScript(import.meta.url, async () => {
    const result = await runMigrations();
    process.stdout.write(`${JSON.stringify(result)}\n`);
});
