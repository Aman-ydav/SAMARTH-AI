import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAuthDb, startAuthDb, stopTestDb } from "#tests/helpers/authDb.js";
import { RefreshSession } from "./refreshSession.model.js";

beforeAll(startAuthDb);
afterAll(stopTestDb);
beforeEach(resetAuthDb);

const id = () => new mongoose.Types.ObjectId();
const hex = (char) => char.repeat(64);
const makeRow = (overrides = {}) => ({
    orgId: id(),
    userId: id(),
    familyId: id().toHexString(),
    tokenHash: hex("a"),
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    absoluteExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
});

describe("RefreshSession model", () => {
    it("declares its indexes, with a unique token hash and a 30-day TTL grace on expiresAt (R7)", async () => {
        const indexes = Object.fromEntries(
            (await RefreshSession.collection.indexes()).map((i) => [i.name, i])
        );
        expect(indexes.refreshSessions_tokenHash_uq).toMatchObject({
            unique: true,
        });
        expect(indexes.refreshSessions_expiresAt_ttl.expireAfterSeconds).toBe(
            2_592_000
        );
        expect(indexes.refreshSessions_familyId.key).toEqual({ familyId: 1 });
        expect(indexes.refreshSessions_userId_revokedAt_expiresAt.key).toEqual({
            userId: 1,
            revokedAt: 1,
            expiresAt: 1,
        });
    });

    it("applies defaults and timestamps", async () => {
        const row = await RefreshSession.create(makeRow());
        expect(row).toMatchObject({
            revokedAt: null,
            replacedBy: null,
            remember: false,
        });
        expect(row.createdAt).toBeInstanceOf(Date);
    });

    it("refuses a duplicate token hash", async () => {
        await RefreshSession.create(makeRow());
        await expect(RefreshSession.create(makeRow())).rejects.toMatchObject({
            code: 11000,
        });
    });

    it("hides the token hash unless selected and from toJSON", async () => {
        const created = await RefreshSession.create(makeRow());
        expect(
            (await RefreshSession.findById(created._id)).tokenHash
        ).toBeUndefined();
        const selected = await RefreshSession.findById(created._id).select(
            "+tokenHash"
        );
        expect(selected.tokenHash).toBe(hex("a"));
        expect(selected.toJSON()).not.toHaveProperty("tokenHash");
    });

    it("keeps the user agent at 200 characters and validates the revoke reason", async () => {
        await expect(
            RefreshSession.create(makeRow({ userAgent: "x".repeat(201) }))
        ).rejects.toThrow();
        await expect(
            RefreshSession.create(makeRow({ revokedReason: "because" }))
        ).rejects.toThrow();
        await expect(
            RefreshSession.create(
                makeRow({ revokedReason: "rotated", tokenHash: hex("b") })
            )
        ).resolves.toBeTruthy();
    });

    it("requires the identity fields and a 64 character hash; the family id is immutable", async () => {
        await expect(
            RefreshSession.create(makeRow({ userId: undefined }))
        ).rejects.toThrow(/USER_REQUIRED/);
        await expect(
            RefreshSession.create(makeRow({ familyId: undefined }))
        ).rejects.toThrow(/FAMILY_REQUIRED/);
        await expect(
            RefreshSession.create(makeRow({ tokenHash: "short" }))
        ).rejects.toThrow();
        await expect(
            RefreshSession.create(makeRow({ absoluteExpiresAt: undefined }))
        ).rejects.toThrow();
        const row = await RefreshSession.create(makeRow());
        const original = row.familyId;
        row.familyId = "changed";
        await row.save();
        expect((await RefreshSession.findById(row._id)).familyId).toBe(
            original
        );
    });
});
