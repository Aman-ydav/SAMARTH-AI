import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { AUDIT_GENESIS_HASH, AuditLog } from "./auditLog.model.js";
import { Counter } from "./counter.model.js";

const valid = (overrides = {}) => ({
    seq: 1,
    at: new Date(),
    orgId: new mongoose.Types.ObjectId(),
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: "user",
    prevHash: AUDIT_GENESIS_HASH,
    hash: "a".repeat(64),
    ...overrides,
});

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

describe("AuditLog model", () => {
    it("declares the named indexes, with unique seq and hash", async () => {
        const indexes = await AuditLog.collection.indexes();
        const byName = Object.fromEntries(indexes.map((i) => [i.name, i]));
        expect(byName.auditLogs_seq_uq.unique).toBe(true);
        expect(byName.auditLogs_hash_uq.unique).toBe(true);
        expect(byName).toHaveProperty("auditLogs_actorId_at");
        expect(byName).toHaveProperty("auditLogs_orgId_at");
        expect(byName).toHaveProperty("auditLogs_entityType_entityId_at");
    });

    it("has createdAt but no updatedAt", async () => {
        const row = await AuditLog.create(valid());
        expect(row.createdAt).toBeInstanceOf(Date);
        expect(row.updatedAt).toBeUndefined();
    });

    it("rejects an unknown action, a bad hash and a missing orgId", async () => {
        await expect(
            AuditLog.create(valid({ action: "NOPE" }))
        ).rejects.toThrow();
        await expect(AuditLog.create(valid({ hash: "xyz" }))).rejects.toThrow(
            /HASH_INVALID/
        );
        await expect(
            AuditLog.create(valid({ orgId: undefined }))
        ).rejects.toThrow(/ORG_REQUIRED/);
    });

    it("rejects a duplicate seq", async () => {
        await AuditLog.create(valid());
        await expect(
            AuditLog.create(valid({ hash: "c".repeat(64) }))
        ).rejects.toMatchObject({ code: 11000 });
    });

    it.each([
        [
            "updateOne",
            (id) =>
                AuditLog.updateOne({ _id: id }, { action: "SESSION_REVOKED" }),
        ],
        ["updateMany", () => AuditLog.updateMany({}, { entityType: "x" })],
        [
            "findOneAndUpdate",
            (id) => AuditLog.findOneAndUpdate({ _id: id }, { entityType: "x" }),
        ],
        ["replaceOne", (id) => AuditLog.replaceOne({ _id: id }, valid())],
        ["deleteOne (query)", (id) => AuditLog.deleteOne({ _id: id })],
        ["deleteMany", () => AuditLog.deleteMany({})],
        ["findOneAndDelete", (id) => AuditLog.findOneAndDelete({ _id: id })],
    ])("is append-only: %s throws", async (_name, run) => {
        const row = await AuditLog.create(valid());
        await expect(run(row._id)).rejects.toThrow("AUDIT_LOG_APPEND_ONLY");
        expect(await AuditLog.countDocuments({})).toBe(1);
    });

    it("blocks re-saving and document deletion", async () => {
        const row = await AuditLog.create(valid());
        row.entityType = "other";
        await expect(row.save()).rejects.toThrow("AUDIT_LOG_APPEND_ONLY");
        await expect(row.deleteOne()).rejects.toThrow("AUDIT_LOG_APPEND_ONLY");
    });
});

describe("Counter model", () => {
    it("stores a named sequence and hides internals in toJSON", async () => {
        const counter = await Counter.create({ _id: "auditSeq", seq: 3 });
        const json = counter.toJSON();
        expect(json).toMatchObject({ id: "auditSeq", seq: 3 });
        expect(json).not.toHaveProperty("__v");
        expect(json).not.toHaveProperty("_id");
    });

    it("rejects a negative or fractional sequence", async () => {
        await expect(Counter.create({ _id: "a", seq: -1 })).rejects.toThrow();
        await expect(Counter.create({ _id: "b", seq: 1.5 })).rejects.toThrow();
    });

    it("increments atomically", async () => {
        await Counter.create({ _id: "auditSeq" });
        await Promise.all(
            Array.from({ length: 8 }, () =>
                Counter.updateOne({ _id: "auditSeq" }, { $inc: { seq: 1 } })
            )
        );
        expect((await Counter.findById("auditSeq").lean()).seq).toBe(8);
    });
});
