import mongoose from "mongoose";
import "#modules/audit/auditLog.model.js";
import "#modules/audit/counter.model.js";
import "#modules/auth/authToken.model.js";
import "#modules/auth/loginAttempt.model.js";
import "#modules/auth/refreshSession.model.js";
import "#modules/users/invite.model.js";
import "#modules/users/user.model.js";
import { startTestDb, stopTestDb } from "./testDb.js";

/**
 * Starts this file's in-memory database AND builds every auth-related index, so unique and partial indexes behave in
 * tests the way they do in production (autoIndex builds lazily and would race the first insert).
 */
export async function startAuthDb() {
    const info = await startTestDb();
    await Promise.all(
        mongoose.modelNames().map((name) => mongoose.model(name).init())
    );
    return info;
}

export { stopTestDb };

/** Empties every collection but keeps the indexes (between tests). */
export async function resetAuthDb() {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(
        collections.map((collection) => collection.deleteMany({}))
    );
}
