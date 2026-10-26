import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { cloudinaryFake } from "#integrations/cloudinary/cloudinary.mock.js";
import { makeMediaAttrs } from "#tests/factories/media.factory.js";
import {
    clearCollections,
    startTestDb,
    stopTestDb,
} from "#tests/helpers/testDb.js";
import { PURGED_RETENTION_MS } from "./media.constants.js";
import { Media } from "./media.model.js";
import {
    markPurged,
    purgeAsset,
    retireMedia,
    softDeleteMedia,
} from "./mediaCleanup.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const withDeleted = (id) =>
    Media.findById(id).setOptions({ withDeleted: true });

describe("media cleanup (MEDIA-09, MEDIA-11)", () => {
    beforeAll(startTestDb);
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
    });

    it("softDeleteMedia marks the record deleted, stops its TTL clock and returns it", async () => {
        const doc = await Media.create(makeMediaAttrs({ expiresAt: NOW }));
        const deleted = await softDeleteMedia({ _id: doc._id }, NOW);
        expect(deleted.status).toBe("deleted");
        expect(deleted.deletedAt).toEqual(NOW);
        expect(deleted.expiresAt).toBeUndefined();
    });

    it("softDeleteMedia is idempotent: a second call matches nothing", async () => {
        const doc = await Media.create(makeMediaAttrs());
        await softDeleteMedia({ _id: doc._id }, NOW);
        expect(await softDeleteMedia({ _id: doc._id }, NOW)).toBeNull();
    });

    it("purgeAsset deletes by stored publicId, resourceType and delivery type, then marks the row purged", async () => {
        const doc = await Media.create(
            makeMediaAttrs({
                resourceType: "raw",
                deliveryType: "authenticated",
                status: "deleted",
                deletedAt: NOW,
            })
        );
        expect(await purgeAsset(doc, NOW)).toBe(true);
        expect(cloudinaryFake.destroys).toHaveLength(1);
        expect(cloudinaryFake.destroys[0].publicId).toBe(doc.publicId);
        expect(cloudinaryFake.destroys[0].options).toMatchObject({
            resource_type: "raw",
            type: "authenticated",
            invalidate: true,
        });
        const fresh = await withDeleted(doc._id);
        expect(fresh.purgedAt).toEqual(NOW);
        expect(fresh.expiresAt.getTime()).toBe(
            NOW.getTime() + PURGED_RETENTION_MS
        );
    });

    it("purgeAsset never throws when Cloudinary fails: it returns false and leaves purgedAt null for the sweep", async () => {
        cloudinaryFake.destroyError = { http_code: 404, message: "boom" };
        const doc = await Media.create(
            makeMediaAttrs({ status: "deleted", deletedAt: NOW })
        );
        expect(await purgeAsset(doc, NOW)).toBe(false);
        expect((await withDeleted(doc._id)).purgedAt).toBeNull();
    });

    it("purgeAsset handles a legacy asset that has no media row", async () => {
        const legacy = {
            publicId: "samarth-ai/test/avatars/legacy",
            resourceType: "image",
            deliveryType: "public",
        };
        expect(await purgeAsset(legacy, NOW)).toBe(true);
        expect(cloudinaryFake.destroys[0].publicId).toBe(legacy.publicId);
        await expect(markPurged(legacy, NOW)).resolves.toBeUndefined();
    });

    it("retireMedia updates the database first, then deletes the asset (MEDIA-11)", async () => {
        const doc = await Media.create(makeMediaAttrs());
        let statusWhenDeleting;
        vi.spyOn(cloudinaryFake.uploader, "destroy").mockImplementation(
            async () => {
                statusWhenDeleting = (await withDeleted(doc._id)).status;
                return { result: "ok" };
            }
        );
        expect(await retireMedia(doc, NOW)).toBe(true);
        expect(statusWhenDeleting).toBe("deleted");
        expect((await withDeleted(doc._id)).purgedAt).toEqual(NOW);
    });
});
