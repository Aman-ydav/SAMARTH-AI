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
import { sweepMedia } from "./mediaSweep.service.js";

vi.mock("cloudinary", async (importOriginal) =>
    (
        await import("#integrations/cloudinary/cloudinary.mock.js")
    ).buildMockedCloudinaryModule(await importOriginal())
);

const NOW = new Date("2026-10-26T10:00:00.000Z");
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3600 * 1000);
const silent = { info() {}, warn() {}, error() {} };
const sweep = (options = {}) =>
    sweepMedia({ now: NOW, log: silent, ...options });
const withDeleted = (id) =>
    Media.findById(id).setOptions({ withDeleted: true });
/** `createdAt` is managed by timestamps, so backdate through the driver. */
async function make(attrs, createdAt) {
    const doc = await Media.create(attrs);
    await Media.collection.updateOne({ _id: doc._id }, { $set: { createdAt } });
    return doc;
}

describe("mediaSweep.service (MEDIA-12)", () => {
    beforeAll(async () => {
        await startTestDb();
        await Media.init();
    });
    afterAll(stopTestDb);
    beforeEach(async () => {
        await clearCollections();
        cloudinaryFake.reset();
    });

    it("retires pending uploads never confirmed after 24 h and leaves fresh ones alone", async () => {
        const stale = await make(makePendingAttrs(), hoursAgo(25));
        const fresh = await make(makePendingAttrs(), hoursAgo(23));
        const result = await sweep();
        expect(result.stalePending).toEqual({ found: 1, purged: 1, failed: 0 });
        expect(await withDeleted(stale._id)).toMatchObject({
            status: "deleted",
            purgedAt: NOW,
        });
        expect((await withDeleted(fresh._id)).status).toBe("pending");
        expect(cloudinaryFake.destroys.map((d) => d.publicId)).toEqual([
            stale.publicId,
        ]);
    });

    it("deletes temp/ assets older than 24 h but not other kinds or younger temp assets", async () => {
        const oldTemp = await make(
            makeMediaAttrs({ kind: "temp", resourceType: "image" }),
            hoursAgo(30)
        );
        const newTemp = await make(
            makeMediaAttrs({ kind: "temp", resourceType: "image" }),
            hoursAgo(2)
        );
        const oldContent = await make(makeMediaAttrs(), hoursAgo(300));
        const result = await sweep();
        expect(result.expiredTemp).toEqual({ found: 1, purged: 1, failed: 0 });
        expect((await withDeleted(oldTemp._id)).status).toBe("deleted");
        expect((await withDeleted(newTemp._id)).status).toBe("ready");
        expect((await withDeleted(oldContent._id)).status).toBe("ready");
    });

    it("retries deleted records whose Cloudinary delete failed earlier", async () => {
        const stuck = await Media.create(
            makeMediaAttrs({ status: "deleted", deletedAt: hoursAgo(1) })
        );
        const justNow = await Media.create(
            makeMediaAttrs({
                status: "deleted",
                deletedAt: new Date(NOW.getTime() - 60_000),
            })
        );
        const done = await Media.create(
            makeMediaAttrs({
                status: "deleted",
                deletedAt: hoursAgo(5),
                purgedAt: hoursAgo(4),
            })
        );
        const result = await sweep();
        expect(result.retriedPurges).toEqual({
            found: 1,
            purged: 1,
            failed: 0,
        });
        expect((await withDeleted(stuck._id)).purgedAt).toEqual(NOW);
        expect((await withDeleted(justNow._id)).purgedAt).toBeNull();
        expect((await withDeleted(done._id)).purgedAt).toEqual(hoursAgo(4));
    });

    it("counts failures and keeps going when Cloudinary rejects a delete", async () => {
        cloudinaryFake.destroyError = { http_code: 404 };
        await make(makePendingAttrs(), hoursAgo(30));
        await make(makePendingAttrs(), hoursAgo(31));
        const result = await sweep();
        expect(result.stalePending).toEqual({ found: 2, purged: 0, failed: 2 });
        expect(
            await Media.countDocuments({
                purgedAt: null,
                status: "deleted",
            }).setOptions({ withDeleted: true })
        ).toBe(2);
    });

    it("respects the batch size so one run stays bounded", async () => {
        for (const hours of [30, 31, 32])
            await make(makePendingAttrs(), hoursAgo(hours));
        const result = await sweep({ batchSize: 2 });
        expect(result.stalePending.found).toBe(2);
        expect(cloudinaryFake.destroys).toHaveLength(2);
        expect((await sweep({ batchSize: 2 })).stalePending.found).toBe(1);
    });

    it("dry run reports candidates and changes nothing", async () => {
        const stale = await make(makePendingAttrs(), hoursAgo(30));
        await make(
            makeMediaAttrs({ kind: "temp", resourceType: "image" }),
            hoursAgo(30)
        );
        const result = await sweep({ dryRun: true });
        expect(result).toMatchObject({
            dryRun: true,
            stalePending: { found: 1, purged: 0, failed: 0 },
            expiredTemp: { found: 1, purged: 0, failed: 0 },
        });
        expect(cloudinaryFake.destroys).toHaveLength(0);
        expect((await withDeleted(stale._id)).status).toBe("pending");
    });

    it("logs one summary line and works with the default clock and logger", async () => {
        const log = { info: vi.fn() };
        const result = await sweepMedia({ log });
        expect(log.info).toHaveBeenCalledWith(
            expect.objectContaining({ event: "media.sweep" }),
            "media orphan sweep finished"
        );
        expect(result.stalePending.found).toBe(0);
    });
});
