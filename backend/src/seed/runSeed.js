import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { env } from "#config/env.js";
import { runAsScript } from "#db/connect.js";
import { logger } from "#utils/logger.js";

const SEED_DIR = fileURLToPath(new URL(".", import.meta.url));
const SEED_FILE = /^[a-z][a-zA-Z0-9]*\.seed\.js$/;

/**
 * Runs every `<topic>.seed.js` in file order (DB-36). Each seed exports `seed({ log })` and MUST be idempotent
 * (upsert by stable keys, `$setOnInsert` for insert-only fields). Production is refused unless `force` is true.
 * @returns {Promise<string[]>} the seed files that ran
 */
export async function runSeeds({
    dir = SEED_DIR,
    force = false,
    config = env,
    log = logger,
} = {}) {
    if (config.isProduction && !force) {
        throw new Error("Refusing to seed in production without --force");
    }
    const files = (await readdir(dir))
        .filter((name) => SEED_FILE.test(name))
        .sort();
    for (const file of files) {
        const module = await import(pathToFileURL(path.join(dir, file)).href);
        if (typeof module.seed !== "function") {
            throw new Error(`Seed ${file} must export a seed() function`);
        }
        await module.seed({ log });
        log.info({ seed: file }, "seed applied");
    }
    return files;
}

await runAsScript(import.meta.url, async (args) => {
    const ran = await runSeeds({ force: args.includes("--force") });
    process.stdout.write(`${JSON.stringify({ ran })}\n`);
});
