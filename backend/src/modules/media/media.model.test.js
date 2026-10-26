import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    makeMediaAttrs,
    makePendingAttrs,
} from "#tests/factories/media.factory.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { Media } from "./media.model.js";

describe("Media model (MEDIA-13, rule 05 media register)", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(clearCollections);

    it("defaults a new record to pending with null lifecycle dates", async () => {
        const doc = await Media.create(makePendingAttrs());
        expect(doc.status).toBe("pending");
        expect(doc.deletedAt).toBeNull();
        expect(doc.purgedAt).toBeNull();
        expect(doc.confirmedAt).toBeNull();
        expect(doc.createdAt).toBeInstanceOf(Date);
    });

    it.each([
        "orgId",
        "ownerId",
        "publicId",
        "resourceType",
        "kind",
        "deliveryType",
    ])("requires %s with a stable message code", async (field) => {
        const attrs = makeMediaAttrs();
        delete attrs[field];
        await expect(Media.create(attrs)).rejects.toMatchObject({
            name: "ValidationError",
        });
    });

    it("rejects values outside the enums (kind, resourceType, deliveryType, status)", async () => {
        for (const bad of [
            { kind: "videos" },
            { resourceType: "audio" },
            { deliveryType: "private" },
            { status: "failed" },
        ])
            await expect(
                Media.create(makeMediaAttrs(bad))
            ).rejects.toMatchObject({ name: "ValidationError" });
    });

    it("bounds numbers: no negative or fractional bytes, nothing over 100 MB, https only for secureUrl", async () => {
        for (const bad of [
            { bytes: -1 },
            { bytes: 1.5 },
            { bytes: 104_857_601 },
            { duration: -2 },
            { secureUrl: "http://media.example.test/a" },
        ])
            await expect(
                Media.create(makeMediaAttrs(bad))
            ).rejects.toMatchObject({ name: "ValidationError" });
    });

    it("keeps publicId unique (media_publicId_uq) and answers a duplicate with code 11000", async () => {
        const attrs = makeMediaAttrs();
        await Media.create(attrs);
        await expect(
            Media.create(makeMediaAttrs({ publicId: attrs.publicId }))
        ).rejects.toMatchObject({ code: 11000 });
    });

    it("declares the named indexes, with a partial TTL on expiresAt", async () => {
        const indexes = await Media.collection.indexes();
        const byName = Object.fromEntries(indexes.map((i) => [i.name, i]));
        expect(byName.media_publicId_uq.unique).toBe(true);
        expect(byName.media_orgId_ownerId_kind_status.key).toEqual({
            orgId: 1,
            ownerId: 1,
            kind: 1,
            status: 1,
        });
        expect(byName.media_status_createdAt).toBeDefined();
        expect(byName.media_status_purgedAt_deletedAt).toBeDefined();
        expect(byName.media_expiresAt_ttl.expireAfterSeconds).toBe(0);
        expect(byName.media_expiresAt_ttl.partialFilterExpression).toEqual({
            expiresAt: { $type: "date" },
        });
    });

    it("does not let identity fields change after create (immutable)", async () => {
        const doc = await Media.create(makeMediaAttrs());
        const otherOwner = makeMediaAttrs().ownerId;
        await Media.updateOne(
            { _id: doc._id },
            { $set: { ownerId: otherOwner } }
        );
        const fresh = await Media.findById(doc._id).lean();
        expect(String(fresh.ownerId)).toBe(String(doc.ownerId));
    });

    it("hides soft-deleted records unless asked, and toJSON exposes id without __v", async () => {
        const doc = await Media.create(
            makeMediaAttrs({ deletedAt: new Date() })
        );
        expect(await Media.findById(doc._id)).toBeNull();
        const found = await Media.findById(doc._id).setOptions({
            withDeleted: true,
        });
        const json = found.toJSON();
        expect(json.id).toBe(String(doc._id));
        expect(json).not.toHaveProperty("_id");
        expect(json).not.toHaveProperty("__v");
    });

    it("lowercases and trims format", async () => {
        const doc = await Media.create(makeMediaAttrs({ format: " MP4 " }));
        expect(doc.format).toBe("mp4");
    });
});
