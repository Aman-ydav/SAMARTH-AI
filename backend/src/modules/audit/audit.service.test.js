import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { withTransaction } from "#db/transaction.js";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { AUDIT_GENESIS_HASH, AuditLog } from "./auditLog.model.js";
import {
    appendAudit,
    canonicalJson,
    computeAuditHash,
    verifyAuditChain,
} from "./audit.service.js";
import { Counter } from "./counter.model.js";

const userId = () => new mongoose.Types.ObjectId();
const event = (overrides = {}) => ({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: "user",
    entityId: userId(),
    actorId: userId(),
    meta: { remember: true },
    ...overrides,
});

describe("canonicalJson", () => {
    it("sorts keys at every level and skips undefined", () => {
        expect(
            canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })
        ).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
        expect(canonicalJson(null)).toBe("null");
        expect(canonicalJson(undefined)).toBe("null");
    });
});

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

describe("appendAudit", () => {
    it("starts the chain at seq 1 with the genesis previous hash and a verifiable hash", async () => {
        const saved = await appendAudit(event());
        expect(saved.seq).toBe(1);
        expect(saved.prevHash).toBe(AUDIT_GENESIS_HASH);
        expect(saved.hash).toBe(computeAuditHash(saved.toObject()));
        expect(String(saved.orgId)).toBe(DEFAULT_ORG_ID);
    });

    it("links every entry to the previous hash", async () => {
        const first = await appendAudit(event());
        const second = await appendAudit(
            event({ action: AUDIT_ACTIONS.LOGOUT_ALL })
        );
        expect(second.seq).toBe(2);
        expect(second.prevHash).toBe(first.hash);
        await expect(verifyAuditChain()).resolves.toEqual({
            valid: true,
            count: 2,
        });
    });

    it("keeps the chain intact under concurrent appends (no forks, no gaps)", async () => {
        await Promise.all(
            Array.from({ length: 12 }, () => appendAudit(event()))
        );
        const rows = await AuditLog.find({}).sort({ seq: 1 }).limit(50).lean();
        expect(rows.map((row) => row.seq)).toEqual(
            Array.from({ length: 12 }, (_, i) => i + 1)
        );
        await expect(verifyAuditChain({ batchSize: 5 })).resolves.toEqual({
            valid: true,
            count: 12,
        });
    });

    it("joins a caller's transaction and rolls the counter back with it", async () => {
        await appendAudit(event());
        await expect(
            withTransaction(async (session) => {
                await appendAudit(event(), { session });
                throw new Error("abort");
            })
        ).rejects.toThrow("abort");
        expect((await Counter.findById("auditSeq").lean()).seq).toBe(1);
        const next = await appendAudit(event());
        expect(next.seq).toBe(2);
    });

    it("rejects unknown actions", async () => {
        await expect(appendAudit(event({ action: "NOPE" }))).rejects.toThrow(
            /Unknown audit action/
        );
    });

    it.each([
        [{ password: "x" }, /not allowed/],
        [{ nested: { refreshToken: "x" } }, /not allowed/],
        [{ note: "someone@example.test" }, /raw emails/],
        [{ blob: "x".repeat(5000) }, /4 KB/],
    ])("refuses unsafe meta %#", async (meta, message) => {
        await expect(appendAudit(event({ meta }))).rejects.toThrow(message);
    });

    it("accepts hashes and flags in meta", async () => {
        await expect(
            appendAudit(
                event({ meta: { emailHash: "a".repeat(64), limited: false } })
            )
        ).resolves.toBeTruthy();
    });
});

describe("verifyAuditChain", () => {
    it("is valid for an empty log", async () => {
        await expect(verifyAuditChain()).resolves.toEqual({
            valid: true,
            count: 0,
        });
    });

    it("detects an edited entry and names its seq", async () => {
        for (let i = 0; i < 4; i += 1) await appendAudit(event());
        await AuditLog.collection.updateOne(
            { seq: 3 },
            { $set: { action: "SESSION_REVOKED" } }
        );
        await expect(verifyAuditChain()).resolves.toEqual({
            valid: false,
            brokenAtSeq: 3,
        });
    });

    it("detects a deleted entry", async () => {
        for (let i = 0; i < 4; i += 1) await appendAudit(event());
        await AuditLog.collection.deleteOne({ seq: 2 });
        await expect(verifyAuditChain()).resolves.toEqual({
            valid: false,
            brokenAtSeq: 3,
        });
    });

    it("detects a re-linked previous hash", async () => {
        for (let i = 0; i < 3; i += 1) await appendAudit(event());
        await AuditLog.collection.updateOne(
            { seq: 2 },
            { $set: { prevHash: "b".repeat(64) } }
        );
        await expect(verifyAuditChain()).resolves.toEqual({
            valid: false,
            brokenAtSeq: 2,
        });
    });
});
