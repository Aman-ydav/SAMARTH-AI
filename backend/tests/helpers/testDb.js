import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { inject } from "vitest";
import { connectDb, disconnectDb } from "#db/connect.js";

/**
 * Connects Mongoose to the shared in-memory replica set (started once in tests/setup/globalSetup.js) using a database
 * that belongs to this test file only (TEST-21). Call in `beforeAll`; pair with `stopTestDb` in `afterAll`.
 */
export async function startTestDb() {
    const uri = inject("mongoUri");
    if (!uri) {
        throw new Error(
            `In-memory MongoDB is unavailable, DB-backed tests cannot run: ${inject("mongoError") || "unknown reason"}`
        );
    }
    const dbName = `t${randomBytes(6).toString("hex")}`;
    await connectDb({
        uri,
        dbName,
        isProduction: false,
        log: { info() {}, warn() {}, error() {} },
    });
    return { uri, dbName };
}

/** Drops this file's database and disconnects. */
export async function stopTestDb() {
    if (mongoose.connection.readyState === 1)
        await mongoose.connection.dropDatabase();
    await disconnectDb();
}

/** Empties every collection between tests (indexes stay). */
export async function clearCollections() {
    for (const collection of await mongoose.connection.db.collections())
        await collection.deleteMany({});
}
