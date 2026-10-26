import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { logger } from "#utils/logger.js";
import { runAsScript } from "./connect.js";

const MODULES_DIR = fileURLToPath(new URL("../modules", import.meta.url));

/** Imports every `modules/<m>/<entity>.model.js` so all models are registered (FS-13). Returns the registered model names. */
export async function loadModels(modulesDir = MODULES_DIR) {
    let modules = [];
    try {
        modules = await readdir(modulesDir, { withFileTypes: true });
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    for (const entry of modules.filter((item) => item.isDirectory())) {
        const files = await readdir(path.join(modulesDir, entry.name));
        for (const file of files.filter((name) => name.endsWith(".model.js"))) {
            await import(
                pathToFileURL(path.join(modulesDir, entry.name, file)).href
            );
        }
    }
    return mongoose.modelNames();
}

/** Dry run (DB-25): what `syncIndexes` would create and drop per model. Changes nothing. */
export async function diffAllIndexes() {
    const report = [];
    for (const name of mongoose.modelNames()) {
        const { toCreate, toDrop } = await mongoose.model(name).diffIndexes();
        report.push({ model: name, toCreate, toDrop });
    }
    return report;
}

/** Applies the declared indexes to the database; returns the names dropped per model. */
export async function applyAllIndexes() {
    const result = [];
    for (const name of mongoose.modelNames()) {
        result.push({
            model: name,
            dropped: await mongoose.model(name).syncIndexes(),
        });
    }
    return result;
}

/** `npm run db:sync-indexes` prints the diff; add `-- --apply` to change the database. */
export async function main(args = []) {
    await loadModels();
    const diff = await diffAllIndexes();
    logger.info({ diff }, "index diff (dry run)");
    process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
    if (args.includes("--apply")) {
        const applied = await applyAllIndexes();
        logger.info({ applied }, "indexes synced");
        process.stdout.write(`${JSON.stringify(applied, null, 2)}\n`);
    }
}

await runAsScript(import.meta.url, main);
