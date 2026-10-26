import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet;

/**
 * Starts ONE single-node in-memory replica set for the whole run (DB-33, TEST-18); a replica set is needed for transactions.
 * Each test file gets its own database name on it (see tests/helpers/testDb.js), so files stay isolated (TEST-21).
 * If the binary cannot start (offline first run), DB-backed tests fail with the reason instead of the whole run aborting.
 */
export default async function setup(project) {
    try {
        replSet = await MongoMemoryReplSet.create({
            replSet: { count: 1, storageEngine: "wiredTiger" },
        });
        project.provide("mongoUri", replSet.getUri());
        project.provide("mongoError", "");
    } catch (error) {
        project.provide("mongoUri", "");
        project.provide("mongoError", String(error?.message ?? error));
    }
    return async () => {
        await replSet?.stop();
    };
}
