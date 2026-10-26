import mongoose from "mongoose";

/**
 * Runs `work(session)` in a transaction and retries transient errors (DB-32). Every operation inside MUST pass the session.
 * Needs a replica set (Atlas always; tests use MongoMemoryReplSet). Never call email, LLM or Cloudinary inside `work` (DB-33).
 */
export function withTransaction(
    work,
    { connection = mongoose.connection } = {}
) {
    return connection.transaction(work);
}
