import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestEnv } from "#tests/helpers/testEnv.js";
import { runSeeds } from "./runSeed.js";

const quiet = { info() {}, warn() {}, error() {} };

describe("runSeeds (DB-36)", () => {
    let dir;
    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), "samarth-ai-seeds-"));
        globalThis.__seedCalls = [];
    });
    afterEach(async () => {
        delete globalThis.__seedCalls;
        await rm(dir, { recursive: true, force: true });
    });
    const write = (name, body) => writeFile(path.join(dir, name), body);

    it("runs every *.seed.js in file order and ignores other files", async () => {
        await write(
            "b.seed.js",
            "export async function seed() { globalThis.__seedCalls.push('b'); }\n"
        );
        await write(
            "a.seed.js",
            "export async function seed() { globalThis.__seedCalls.push('a'); }\n"
        );
        await write("notes.txt", "ignored");
        await write("Bad.seed.js", "throw new Error('never imported');");
        const ran = await runSeeds({ dir, log: quiet });
        expect(ran).toEqual(["a.seed.js", "b.seed.js"]);
        expect(globalThis.__seedCalls).toEqual(["a", "b"]);
    });

    it("passes the logger to each seed", async () => {
        await write(
            "a.seed.js",
            "export async function seed({ log }) { globalThis.__seedCalls.push(typeof log.info); }\n"
        );
        await runSeeds({ dir, log: quiet });
        expect(globalThis.__seedCalls).toEqual(["function"]);
    });

    it("refuses to run in production without --force, and runs with it", async () => {
        await write(
            "a.seed.js",
            "export async function seed() { globalThis.__seedCalls.push('a'); }\n"
        );
        const production = makeTestEnv({ NODE_ENV: "production" });
        await expect(
            runSeeds({ dir, config: production, log: quiet })
        ).rejects.toThrow("Refusing to seed in production");
        expect(globalThis.__seedCalls).toEqual([]);
        await expect(
            runSeeds({ dir, config: production, force: true, log: quiet })
        ).resolves.toEqual(["a.seed.js"]);
    });

    it("rejects a seed file without seed()", async () => {
        await write("a.seed.js", "export const nothing = 1;\n");
        await expect(runSeeds({ dir, log: quiet })).rejects.toThrow("seed()");
    });

    it("does nothing when there are no seeds", async () => {
        await expect(runSeeds({ dir, log: quiet })).resolves.toEqual([]);
    });
});
